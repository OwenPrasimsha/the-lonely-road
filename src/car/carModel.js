import * as THREE from 'three';
import { PALETTE } from '../palette.js';

/**
 * Car visual contract — anything returned here can drive the game:
 *   root        Object3D, origin at ground level between the wheels, facing +Z
 *   wheels      { fl, fr, rl, rr } Object3Ds that spin around their local X
 *   steerPivots [left, right] Object3Ds rotated around Y for front-wheel steer
 *   rearWheelOffsets  Vector3[] local positions where dust is emitted
 *
 * To use a GLB instead, load it with GLTFLoader and return the same shape, e.g.
 *
 *   const gltf = await new GLTFLoader().loadAsync('/car.glb');
 *   const root = gltf.scene;
 *   const wheels = { fl: root.getObjectByName('WheelFL'), ... };
 *   return { root, wheels, steerPivots: [wheels.fl, wheels.fr], rearWheelOffsets };
 *
 * and pass a factory returning it to `new Car(...)` in src/main.js.
 */
export function createPrimitiveCarModel() {
  const root = new THREE.Group();
  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.6, ...extra });
  const body = mat(PALETTE.carBody, { metalness: 0.15, roughness: 0.45 });
  const trim = mat(PALETTE.carTrim);
  const glass = mat(PALETTE.carGlass, { roughness: 0.2, metalness: 0.3 });
  const tyre = mat(PALETTE.tyre, { roughness: 0.9 });
  const rim = mat(PALETTE.rim, { metalness: 0.5 });

  const add = (geo, m, x, y, z, parent = root) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };

  // body
  add(new THREE.BoxGeometry(1.8, 0.55, 4.1), body, 0, 0.62, 0);
  add(new THREE.BoxGeometry(1.84, 0.12, 4.16), trim, 0, 0.4, 0); // stripe/sill
  // cabin: slightly tapered via scaled top vertices
  const cabinGeo = new THREE.BoxGeometry(1.56, 0.55, 2.0);
  const p = cabinGeo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    if (p.getY(i) > 0) {
      p.setX(i, p.getX(i) * 0.86);
      p.setZ(i, p.getZ(i) * 0.78 - 0.1);
    }
  }
  cabinGeo.computeVertexNormals();
  add(cabinGeo, trim, 0, 1.17, -0.25);
  add(new THREE.BoxGeometry(1.4, 0.4, 0.05), glass, 0, 1.17, 0.68).rotation.x = -0.55; // windscreen
  add(new THREE.BoxGeometry(1.4, 0.36, 0.05), glass, 0, 1.17, -1.13).rotation.x = 0.6; // rear window
  for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.05, 0.32, 1.3), glass, sx * 0.72, 1.19, -0.25);

  // bumpers and lights
  add(new THREE.BoxGeometry(1.86, 0.22, 0.2), trim, 0, 0.42, 2.08);
  add(new THREE.BoxGeometry(1.86, 0.22, 0.2), trim, 0, 0.42, -2.08);
  const head = mat(PALETTE.headlight, { emissive: PALETTE.headlight, emissiveIntensity: 1.4 });
  const tail = mat(PALETTE.taillight, { emissive: PALETTE.taillight, emissiveIntensity: 1.6 });
  for (const sx of [-0.62, 0.62]) {
    add(new THREE.BoxGeometry(0.38, 0.16, 0.06), head, sx, 0.7, 2.06);
    add(new THREE.BoxGeometry(0.38, 0.14, 0.06), tail, sx, 0.7, -2.06);
  }

  // wheels
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.32, 6);
  rimGeo.rotateZ(Math.PI / 2);
  const makeWheel = (x, z, steerable) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.38, z);
    root.add(pivot);
    const spin = new THREE.Group();
    pivot.add(spin);
    add(wheelGeo, tyre, 0, 0, 0, spin);
    add(rimGeo, rim, 0, 0, 0, spin);
    return { pivot: steerable ? pivot : null, spin };
  };
  const fl = makeWheel(0.86, 1.32, true);
  const fr = makeWheel(-0.86, 1.32, true);
  const rl = makeWheel(0.86, -1.3, false);
  const rr = makeWheel(-0.86, -1.3, false);

  return {
    root,
    wheels: { fl: fl.spin, fr: fr.spin, rl: rl.spin, rr: rr.spin },
    steerPivots: [fl.pivot, fr.pivot],
    rearWheelOffsets: [new THREE.Vector3(0.86, 0.05, -1.5), new THREE.Vector3(-0.86, 0.05, -1.5)],
  };
}
