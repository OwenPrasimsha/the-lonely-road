import * as THREE from 'three';
import { valueNoise } from '../world/noise.js';

const damp = (rate, dt) => 1 - Math.exp(-rate * dt);
const lerpAngle = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;

/** Third-person chase camera with trauma-based screen shake. */
export class ChaseCamera {
  constructor(camera, cfg) {
    this.camera = camera;
    this.cfg = cfg;
    this.yaw = 0;
    this.y = 0;
    this.trauma = 0;
    this.time = 0;
    this.base = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.tmp = new THREE.Vector3();
  }

  /** 0..1, stacked and clamped. Shake intensity is trauma². */
  shake(amount) {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  snap(target) {
    this.yaw = target.yaw;
    this.y = target.position.y;
    this.#desired(target, this.base);
    this.trauma = 0;
    this.update(0, target, { snap: true });
  }

  #desired(target, out) {
    const c = this.cfg;
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    return out.set(target.position.x - fx * c.distance, this.y + c.height, target.position.z - fz * c.distance);
  }

  /**
   * @param {{position:THREE.Vector3, yaw:number, speedNorm:number}} target
   * @param {{follow?:boolean, snap?:boolean, orbit?:number}} opts
   */
  update(dt, target, { follow = true, orbit = null } = {}) {
    const c = this.cfg;
    this.time += dt;

    if (orbit !== null) {
      // title screen: slow orbit around the parked car
      const r = 9;
      this.base.set(target.position.x + Math.sin(orbit) * r, target.position.y + 2.6, target.position.z + Math.cos(orbit) * r);
      this.look.copy(target.position).y += 0.9;
    } else {
      if (follow) {
        this.yaw = lerpAngle(this.yaw, target.yaw, damp(c.yawSharpness, dt));
        this.y += (target.position.y - this.y) * damp(c.heightSharpness, dt);
        this.#desired(target, this.tmp);
        this.base.lerp(this.tmp, dt === 0 ? 1 : damp(c.followSharpness, dt));
        // never sink below the car (drops would otherwise pull us into a ledge)
        this.base.y = Math.max(this.base.y, target.position.y + 1.2);
      }
      const fx = Math.sin(this.yaw);
      const fz = Math.cos(this.yaw);
      this.look.set(target.position.x + fx * c.lookAhead, target.position.y + c.lookHeight, target.position.z + fz * c.lookAhead);
      if (!follow) this.look.copy(target.position);
    }

    this.camera.position.copy(this.base);
    this.camera.lookAt(this.look);

    // shake
    this.trauma = Math.max(0, this.trauma - c.shakeDecay * dt);
    const s = this.trauma * this.trauma * c.shakeMagnitude;
    if (s > 0) {
      const t = this.time * 22;
      this.camera.position.x += (valueNoise(t, 1.3) - 0.5) * 2 * s;
      this.camera.position.y += (valueNoise(t, 7.1) - 0.5) * 2 * s;
      this.camera.rotation.z += (valueNoise(t, 13.7) - 0.5) * 0.12 * s;
    }

    const fov = c.fov + c.fovSpeedBoost * (target.speedNorm ?? 0);
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov += (fov - this.camera.fov) * (dt === 0 ? 1 : damp(3, dt));
      this.camera.updateProjectionMatrix();
    }
  }
}
