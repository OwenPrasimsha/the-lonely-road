import * as THREE from 'three';
import './style.css';
import { CONFIG } from './config.js';
import { PALETTE } from './palette.js';
import { getLevels } from './levels.js';
import { buildLevel } from './road/levelBuilder.js';
import { createSky } from './world/sky.js';
import { Car } from './car/car.js';
import { createPrimitiveCarModel } from './car/carModel.js';
import { ChaseCamera } from './camera/chaseCamera.js';
import { FixedStepper } from './physics/fixedStep.js';
import { autopilotSteer } from './physics/autopilot.js';
import { Dust } from './fx/dust.js';
import { AudioEngine } from './audio/audio.js';
import { TauntPicker } from './taunts.js';
import { UI } from './ui/ui.js';
import { Input } from './ui/input.js';
import { loadRecords, saveRun, saveMuted, saveSpicy } from './storage.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Game states
 *   title       parked car, orbit camera
 *   playing     driving, timer running
 *   crashing    crash animation before the taunt
 *   crashed     taunt screen up
 *   transition  level 1 cleared, rolling into level 2
 *   finished    level 2 cleared
 *   fading      screen is black/fading, input ignored
 */
class Game {
  constructor() {
    this.isMobile = window.matchMedia('(pointer: coarse)').matches;
    this.#setupRenderer();
    this.#setupScene();

    this.levels = getLevels().map((def) => buildLevel(def, CONFIG));
    for (const l of this.levels) this.scene.add(l.group);

    this.car = new Car(createPrimitiveCarModel, CONFIG);
    this.scene.add(this.car.object);
    this.dust = new Dust();
    this.scene.add(this.dust.points);

    this.chase = new ChaseCamera(this.camera, CONFIG.camera);
    this.stepper = new FixedStepper(CONFIG.physics.fixedDt, CONFIG.physics.maxSubSteps);
    this.audio = new AudioEngine();
    this.taunts = new TauntPicker();
    this.ui = new UI();
    this.input = new Input({ left: this.ui.el.left, right: this.ui.el.right });

    this.records = loadRecords();
    this.audio.muted = this.records.muted;
    this.ui.setMuted(this.records.muted);
    this.taunts.spicy = this.records.spicy;
    this.ui.setSpicy(this.records.spicy);
    // dev helpers: ?autopilot  ?level=2  ?at=<metres along the road>
    const params = new URLSearchParams(location.search);
    this.autopilot = params.has('autopilot');
    const devLevel = Math.min(this.levels.length, Math.max(1, Number(params.get('level')) || 1)) - 1;
    if (params.has('at')) for (const l of this.levels) l.startIndex = l.road.indexAtS(Number(params.get('at')));

    this.state = 'title';
    this.levelIndex = 0;
    this.attempts = [1, 1];
    this.runTime = 0;
    this.crashTimer = 0;
    this.orbit = 0;
    this.dustAcc = 0;
    this.wheelPos = [];
    this.flow = 0; // bumps on every restart so stale timers bail out

    this.#bindControls();
    this.#setLevel(devLevel);
    this.ui.showTitle(true, this.records);
    if (this.autopilot) setTimeout(() => this.start(), 100); // dev: ?autopilot drives itself

    window.addEventListener('resize', () => this.#resize());
    this.#resize();
    this.last = performance.now();
    this.renderer.setAnimationLoop((t) => this.#frame(t));
  }

  // ---------------------------------------------------------------- setup

  #setupRenderer() {
    const canvas = document.getElementById('scene');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = CONFIG.render.shadows;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
  }

  #setupScene() {
    const r = CONFIG.render;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(PALETTE.fog, r.fogNear, r.fogFar);
    this.camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, 1, 0.1, 2000);

    this.sunDir = new THREE.Vector3(0.45, 0.16, 1).normalize(); // low sun ahead of the road
    this.scene.add(new THREE.HemisphereLight(0xffb98a, 0x7a3a26, 1.4));
    const sun = (this.sun = new THREE.DirectionalLight(0xffc794, 2.6));
    sun.castShadow = r.shadows;
    const size = this.isMobile ? 1024 : r.shadowMapSize;
    sun.shadow.mapSize.set(size, size);
    const sc = sun.shadow.camera;
    sc.left = -45;
    sc.right = 45;
    sc.top = 45;
    sc.bottom = -45;
    sc.near = 1;
    sc.far = 260;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.04;
    this.scene.add(sun, sun.target);

    this.sky = createSky(this.sunDir);
    this.scene.add(this.sky);
  }

  #bindControls() {
    this.ui.on('start', () => this.start());
    this.ui.on('retry', () => this.retry());
    this.ui.on('restart', () => this.restart());
    this.ui.on('mute', () => this.toggleMute());
    this.ui.on('spicy', (on) => {
      this.taunts.spicy = on;
      saveSpicy(on);
    });
    this.input.onKey((e) => {
      if (e.code === 'KeyM') return this.toggleMute();
      if (e.code !== 'Enter' && e.code !== 'Space') return;
      if (this.state === 'title') this.start();
      else if (this.state === 'crashed') this.retry();
      else if (this.state === 'finished' && this.ui.finishVisible) this.restart();
    });
  }

  #resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const maxRatio = this.isMobile ? CONFIG.render.mobileMaxPixelRatio : CONFIG.render.maxPixelRatio;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxRatio));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.dust.setViewportHeight(h * this.renderer.getPixelRatio());
  }

  // ---------------------------------------------------------------- flow

  get level() {
    return this.levels[this.levelIndex];
  }

  #setLevel(i) {
    this.levelIndex = i;
    for (const l of this.levels) l.group.visible = l === this.level;
    this.#resetCar();
  }

  #resetCar() {
    this.car.reset(this.level.road, this.level.startIndex);
    this.stepper.reset();
    this.dust.clear();
    this.chase.snap(this.#cameraTarget());
  }

  async start() {
    if (this.state !== 'title') return;
    this.state = 'fading';
    this.audio.init();
    this.audio.setMuted(this.audio.muted);
    this.ui.showTitle(false);
    await this.ui.fade(true, 300);
    this.#resetCar();
    this.ui.showHud(true);
    this.state = 'playing';
    await this.ui.fade(false, 500);
    this.ui.banner(this.level.def.title, this.level.def.subtitle);
  }

  async retry() {
    if (this.state !== 'crashed') return;
    this.state = 'fading';
    const flow = this.flow;
    this.ui.hideCrash();
    this.attempts[this.levelIndex]++;
    await this.ui.fade(true);
    if (flow !== this.flow) return;
    this.#resetCar();
    this.state = 'playing';
    await this.ui.fade(false);
  }

  async restart() {
    if (this.state !== 'finished') return;
    this.flow++;
    this.state = 'fading';
    this.ui.hideFinish();
    await this.ui.fade(true);
    this.attempts = [1, 1];
    this.runTime = 0;
    this.#setLevel(0);
    this.state = 'playing';
    await this.ui.fade(false);
    this.ui.banner(this.level.def.title, this.level.def.subtitle);
  }

  toggleMute() {
    this.audio.setMuted(!this.audio.muted);
    this.ui.setMuted(this.audio.muted);
    saveMuted(this.audio.muted);
  }

  async #onFinishLine() {
    const flow = this.flow;
    this.car.vehicle.coasting = true;
    if (this.levelIndex === 0) {
      this.state = 'transition';
      this.audio.levelJingle();
      this.ui.banner('Level 1 complete', 'That was the hard part.', 2);
      await wait(2200);
      if (flow !== this.flow) return;
      this.state = 'fading';
      await this.ui.fade(true, 600);
      this.#setLevel(1);
      this.state = 'playing';
      await this.ui.fade(false, 600);
      this.ui.banner(this.level.def.title, this.level.def.subtitle);
    } else {
      this.state = 'finished';
      this.audio.finishJingle();
      const attempts = this.attempts[0] + this.attempts[1];
      const records = saveRun(this.runTime, attempts);
      this.records = { ...this.records, ...records };
      await wait(1600);
      if (flow !== this.flow) return;
      this.ui.showFinish({ message: this.taunts.finish(attempts), time: this.runTime, attempts, records });
    }
  }

  #showCrash() {
    this.state = 'crashed';
    const attempt = this.attempts[this.levelIndex];
    this.ui.showCrash({
      reason: this.car.vehicle.crashReason,
      taunt: this.taunts.taunt(attempt),
      attempt,
      level: this.level.def.id,
    });
  }

  // ---------------------------------------------------------------- loop

  #physicsStep = (dt) => {
    const v = this.car.vehicle;
    const road = this.level.road;
    this.car.snapshot();
    const steer = this.state === 'playing' ? (this.autopilot ? autopilotSteer(v, road) : this.input.steer) : 0;
    v.step(dt, { steer }, road, this.level.def);

    for (const e of v.events) {
      if (e.type === 'land' && e.impact > CONFIG.car.hardLandingSpeed) {
        this.chase.shake(Math.min(0.7, e.impact / 22));
        this.audio.land(e.impact);
        this.dust.burst(this.car.object.position, Math.round(e.impact * 2.5), { spread: 2.2, up: 2.2, size: 1.6 });
      } else if (e.type === 'crash') {
        this.state = 'crashing';
        this.crashTimer = 0;
        this.chase.shake(0.95);
        this.audio.crash();
        if (e.reason !== 'fell') this.dust.burst(this.car.object.position, 70, { spread: 2.5, up: 3, size: 2.2, life: 1.8 });
      }
    }
    v.events.length = 0;

    if (this.state === 'playing') {
      this.runTime += dt;
      if (v.s >= road.finishS) this.#onFinishLine();
    } else if (this.state === 'crashing') {
      this.crashTimer += dt;
      if (this.crashTimer >= CONFIG.fail.crashScreenDelay) this.#showCrash();
    }
  };

  #cameraTarget() {
    const v = this.car.vehicle;
    this._target ??= { position: new THREE.Vector3() };
    this._target.position.copy(this.car.object.position);
    this._target.yaw = v.velYaw;
    this._target.speedNorm = Math.min(1, v.speed / CONFIG.level2.speed);
    return this._target;
  }

  #emitTyreDust(dt) {
    const v = this.car.vehicle;
    if (!v.grounded || v.speed < 4 || v.crashed) return;
    this.dustAcc += dt * (6 + v.speed * 0.9);
    if (this.dustAcc < 1) return;
    const wheels = this.car.rearWheelWorld(this.wheelPos);
    const back = { x: -Math.sin(v.velYaw) * v.speed * 0.12, z: -Math.cos(v.velYaw) * v.speed * 0.12 };
    while (this.dustAcc >= 1) {
      this.dustAcc -= 1;
      for (const w of wheels) this.dust.emit(w, { spread: 0.3, up: 0.6, back, size: 0.8, life: 0.9 });
    }
  }

  #frame(now) {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    const v = this.car.vehicle;

    const simulate = this.state !== 'title' && this.state !== 'fading';
    const alpha = simulate ? this.stepper.advance(dt, this.#physicsStep) : 1;
    this.car.sync(alpha);
    this.car.object.updateMatrixWorld(true);

    const target = this.#cameraTarget();
    if (this.state === 'title') {
      this.orbit += dt * 0.18;
      this.chase.update(dt, target, { orbit: this.orbit + 2.3 });
    } else {
      this.chase.update(dt, target, { follow: !v.crashed });
    }

    this.#emitTyreDust(dt);
    this.dust.update(dt);

    // keep the shadow frustum and sky around the player
    const p = this.car.object.position;
    this.sun.position.copy(p).addScaledVector(this.sunDir, 120);
    this.sun.target.position.copy(p);
    this.sun.target.updateMatrixWorld();
    this.sky.position.copy(this.camera.position);

    const engineOn = !v.crashed && this.state !== 'title' && this.state !== 'fading';
    this.audio.setEngine(Math.min(1, v.speed / CONFIG.level2.speed), v.grounded, engineOn);

    this.ui.updateHud({
      level: this.level.def.id,
      attempt: this.attempts[this.levelIndex],
      speedKmh: v.speed * 3.6,
      time: this.runTime,
    });

    this.renderer.render(this.scene, this.camera);
  }
}

new Game();
