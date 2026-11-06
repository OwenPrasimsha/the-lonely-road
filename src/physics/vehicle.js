/**
 * Arcade vehicle controller. The car is a point with a heading that drives
 * over the road surface reported by RoadPath, with gravity for jumps and falls.
 * It cannot glitch through geometry because there is no collision geometry:
 * the road *is* the height function.
 *
 * Pure math (no Three.js) so it runs headless in scripts/simulate.mjs.
 */
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const toward = (v, target, maxDelta) => (Math.abs(target - v) <= maxDelta ? target : v + Math.sign(target - v) * maxDelta);

export const CrashReason = {
  SAND: 'sand',
  FELL: 'fell',
  FLIPPED: 'flipped',
};

export class ArcadeVehicle {
  constructor(carCfg, failCfg, gravity) {
    this.cfg = carCfg;
    this.fail = failCfg;
    this.gravity = gravity;
    this.q = {};
    this.events = [];
    this.reset(null);
  }

  /** Place the car on a road sample, at rest. */
  reset(sample, hintIndex = 0) {
    this.x = sample?.x ?? 0;
    this.y = sample?.y ?? 0;
    this.z = sample?.z ?? 0;
    this.yaw = sample?.heading ?? 0;
    this.velYaw = this.yaw;
    this.speed = 0;
    this.vy = 0;
    this.grounded = true;
    this.airTime = 0;
    this.steer = 0;
    this.yawRate = 0;
    this.roll = 0;
    this.pitch = 0;
    this.wheelSpin = 0;
    this.hint = hintIndex;
    this.crashed = false;
    this.crashReason = null;
    this.crashTime = 0;
    this.crashRollVel = 0;
    this.crashYawVel = 0;
    this.crashRoll = 0;
    this.coasting = false; // true after the finish: roll to a stop, no fail checks
    this.events.length = 0;
    this.s = 0;
    this.d = 0;
  }

  #crash(reason) {
    if (this.crashed || this.coasting) return;
    this.crashed = true;
    this.crashReason = reason;
    this.crashTime = 0;
    const side = Math.sign(this.d || this.steer || 1);
    if (reason === CrashReason.FLIPPED) {
      this.crashRollVel = 7 * side;
      this.vy = 6;
      this.grounded = false;
    } else if (reason === CrashReason.SAND) {
      this.crashYawVel = 2.4 * -side;
      this.crashRollVel = 1.2 * side;
    }
    this.events.push({ type: 'crash', reason });
  }

  /**
   * @param {number} dt fixed timestep
   * @param {{steer:number}} input steer in [-1, 1], +1 = right
   * @param {import('../road/roadPath.js').RoadPath} road
   * @param {{speed:number, drift:number}} level
   */
  step(dt, input, road, level) {
    const c = this.cfg;
    const g = this.gravity;

    // --- steering input with ramp-up / re-centre
    const target = this.crashed || this.coasting ? 0 : clamp(input.steer, -1, 1);
    const reversing = target !== 0 && Math.sign(target) !== Math.sign(this.steer);
    const rate = target === 0 ? c.steerRelease : reversing ? c.steerRelease + c.steerAttack : c.steerAttack;
    this.steer = toward(this.steer, target, rate * dt);

    // --- longitudinal: auto-throttle, no brakes, no reverse
    if (this.crashed) this.speed = toward(this.speed, 0, (this.grounded ? 22 : 4) * dt);
    else if (this.coasting) this.speed = toward(this.speed, 0, 6 * dt);
    else if (this.grounded) this.speed = toward(this.speed, level.speed, c.acceleration * dt);

    // --- yaw
    const control = this.grounded ? 1 : c.airControl;
    this.yawRate = -this.steer * c.steerRate * control * clamp(this.speed / 8, 0, 1);
    this.yaw += this.yawRate * dt;
    if (this.grounded && !this.crashed && !this.coasting) this.yaw -= level.drift * dt;
    if (this.crashed) this.yaw += this.crashYawVel * dt;
    if (this.grounded) this.velYaw += wrap(this.yaw - this.velYaw) * (1 - Math.exp(-c.grip * dt));

    // --- horizontal motion
    this.x += Math.sin(this.velYaw) * this.speed * dt;
    this.z += Math.cos(this.velYaw) * this.speed * dt;
    this.wheelSpin += (this.speed / c.wheelRadius) * dt;

    // --- where is the road?
    const q = road.query(this.x, this.z, this.hint, this.q);
    this.hint = q.index;
    this.s = q.s;
    this.d = q.d;
    const onRoad = Math.abs(q.d) <= q.width / 2 + this.fail.offRoadMargin;
    const elevated = q.sink >= this.fail.elevatedSink;
    const groundY = onRoad ? q.y : elevated ? q.y - q.sink - 0.3 : q.y - 0.12;

    // --- vertical motion
    if (this.grounded) {
      const required = (groundY - this.y) / dt;
      if (required < this.vy - g * dt - c.groundStickTolerance) {
        this.grounded = false; // the ground fell away faster than gravity: we're flying
        this.airTime = 0;
        this.vy -= g * dt;
        this.y += this.vy * dt;
        this.events.push({ type: 'takeoff' });
      } else {
        this.y = groundY;
        this.vy = required;
      }
    } else {
      this.vy -= g * dt;
      this.y += this.vy * dt;
      this.airTime += dt;
      if (this.y <= groundY) {
        const impact = -this.vy;
        this.y = groundY;
        this.vy = onRoad ? q.grade * this.speed : 0;
        this.grounded = true;
        this.events.push({ type: 'land', impact, onRoad });
        const slip = Math.abs(wrap(this.yaw - this.velYaw));
        if (onRoad && impact > c.flipImpactSpeed && slip > c.flipSlipAngle) this.#crash(CrashReason.FLIPPED);
        if (this.crashed && this.crashReason === CrashReason.FLIPPED) this.crashRollVel *= 0.6;
      }
    }

    // --- fail conditions
    if (!this.crashed && !this.coasting) {
      if (!onRoad && !elevated && this.grounded) this.#crash(CrashReason.SAND);
      else if (!onRoad && elevated && this.y < q.y - this.fail.fallDepth) this.#crash(CrashReason.FELL);
    }

    // --- body lean (visual, but flips feed into it)
    const lateral = this.speed * this.yawRate;
    const rollTarget = clamp(lateral * c.rollFactor * 10, -c.maxVisualRoll, c.maxVisualRoll);
    this.roll += (rollTarget - this.roll) * (1 - Math.exp(-8 * dt));
    const pitchTarget = this.grounded
      ? -Math.atan(onRoad ? q.grade : 0)
      : clamp(-Math.atan2(this.vy, Math.max(this.speed, 1)) * 0.6, -0.5, 0.6);
    this.pitch += (pitchTarget - this.pitch) * (1 - Math.exp(-(this.grounded ? 14 : 4) * dt));

    if (this.crashed) {
      this.crashTime += dt;
      this.crashRoll += this.crashRollVel * dt;
      if (this.grounded) {
        this.crashRollVel *= Math.exp(-3 * dt);
        this.crashYawVel *= Math.exp(-2.5 * dt);
      }
    }
  }
}
