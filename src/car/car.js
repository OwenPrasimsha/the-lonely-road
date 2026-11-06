import * as THREE from 'three';
import { ArcadeVehicle } from '../physics/vehicle.js';

const lerpAngle = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;

/**
 * Glue between the physics body (ArcadeVehicle) and whatever model is used
 * for visuals. Keeps the previous physics state so rendering can interpolate
 * between fixed steps.
 */
export class Car {
  /**
   * @param {() => ReturnType<import('./carModel.js').createPrimitiveCarModel>} modelFactory
   */
  constructor(modelFactory, config) {
    this.vehicle = new ArcadeVehicle(config.car, config.fail, config.physics.gravity);
    this.model = modelFactory();
    this.object = new THREE.Group(); // yaw + position
    this.body = new THREE.Group(); // pitch + roll
    this.body.add(this.model.root);
    this.object.add(this.body);
    this.prev = { x: 0, y: 0, z: 0, yaw: 0 };
    this._v = new THREE.Vector3();
  }

  reset(road, index) {
    this.vehicle.reset(road.samples[index], index);
    this.snapshot();
    this.sync(1);
  }

  snapshot() {
    const v = this.vehicle;
    this.prev.x = v.x;
    this.prev.y = v.y;
    this.prev.z = v.z;
    this.prev.yaw = v.yaw;
  }

  /** Update the visual transform. alpha = interpolation factor between physics steps. */
  sync(alpha) {
    const v = this.vehicle;
    const p = this.prev;
    this.object.position.set(p.x + (v.x - p.x) * alpha, p.y + (v.y - p.y) * alpha, p.z + (v.z - p.z) * alpha);
    this.object.rotation.y = lerpAngle(p.yaw, v.yaw, alpha);
    this.body.rotation.set(v.pitch, 0, v.roll + v.crashRoll, 'YXZ');
    if (v.crashRoll !== 0) this.body.position.y = Math.abs(Math.sin(v.crashRoll)) * 0.9;
    else this.body.position.y = 0;

    const w = this.model.wheels;
    for (const k of ['fl', 'fr', 'rl', 'rr']) w[k].rotation.x = v.wheelSpin;
    for (const pivot of this.model.steerPivots) if (pivot) pivot.rotation.y = -v.steer * 0.45;
  }

  /** World positions of the rear wheels (for dust). */
  rearWheelWorld(out) {
    return this.model.rearWheelOffsets.map((o, i) => (out[i] ??= new THREE.Vector3()).copy(o).applyMatrix4(this.object.matrixWorld));
  }
}
