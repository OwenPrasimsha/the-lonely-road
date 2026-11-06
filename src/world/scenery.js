import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createRng } from './noise.js';
import { PALETTE } from '../palette.js';

/** Bake a primitive into a colored, non-indexed piece ready for merging. */
function part(geo, color, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute('uv');
  g.scale(sx, sy, sz);
  g.rotateX(rx);
  g.rotateY(ry);
  g.rotateZ(rz);
  g.translate(x, y, z);
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

const cyl = (rt, rb, h, seg = 7) => new THREE.CylinderGeometry(rt, rb, h, seg);

function saguaro() {
  const c = PALETTE.cactus;
  const d = PALETTE.cactusDark;
  return mergeGeometries([
    part(cyl(0.32, 0.38, 4.2), c, { y: 2.1 }),
    part(new THREE.SphereGeometry(0.32, 7, 4), c, { y: 4.2 }),
    // right arm
    part(cyl(0.2, 0.2, 0.9), d, { x: 0.55, y: 1.9, rz: Math.PI / 2 }),
    part(cyl(0.2, 0.22, 1.5), d, { x: 0.95, y: 2.6 }),
    part(new THREE.SphereGeometry(0.2, 6, 3), d, { x: 0.95, y: 3.35 }),
    // left arm
    part(cyl(0.18, 0.18, 0.7), d, { x: -0.48, y: 2.6, rz: Math.PI / 2 }),
    part(cyl(0.18, 0.2, 1.1), d, { x: -0.8, y: 3.1 }),
    part(new THREE.SphereGeometry(0.18, 6, 3), d, { x: -0.8, y: 3.65 }),
  ]);
}

function barrelCactus() {
  return mergeGeometries([
    part(cyl(0.45, 0.55, 0.9, 8), PALETTE.cactus, { y: 0.45 }),
    part(new THREE.ConeGeometry(0.46, 0.3, 8), PALETTE.cactusDark, { y: 1.05 }),
  ]);
}

function rock() {
  return mergeGeometries([
    part(new THREE.DodecahedronGeometry(1, 0), PALETTE.rock, { sy: 0.6, y: 0.3 }),
    part(new THREE.DodecahedronGeometry(0.55, 0), PALETTE.rockDark, { x: 0.9, y: 0.15, sy: 0.7, ry: 0.6 }),
  ]);
}

function boulder() {
  return part(new THREE.IcosahedronGeometry(1, 0), PALETTE.rockDark, { sy: 0.75, y: 0.4 });
}

const POLE_HEIGHT = 7.2;
function pole() {
  const w = PALETTE.wood;
  return mergeGeometries([
    part(cyl(0.12, 0.16, POLE_HEIGHT, 6), w, { y: POLE_HEIGHT / 2 }),
    part(new THREE.BoxGeometry(2.0, 0.14, 0.14), w, { y: POLE_HEIGHT - 0.6 }),
    part(new THREE.BoxGeometry(0.1, 0.18, 0.1), 0xdedad0, { x: -0.85, y: POLE_HEIGHT - 0.45 }),
    part(new THREE.BoxGeometry(0.1, 0.18, 0.1), 0xdedad0, { x: 0.85, y: POLE_HEIGHT - 0.45 }),
  ]);
}

const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 });

function instanced(geo, transforms) {
  const mesh = new THREE.InstancedMesh(geo, material, Math.max(1, transforms.length));
  mesh.count = transforms.length;
  transforms.forEach((m, i) => mesh.setMatrixAt(i, m));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  return mesh;
}

/** Scatter cacti and rocks along the road and run utility poles beside it. */
export function createScenery(road, field, cfg) {
  const rng = createRng(cfg.seed + road.samples.length);
  const S = road.samples;
  const group = new THREE.Group();
  const kinds = { saguaro: [], barrel: [], rock: [], boulder: [] };
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);

  const place = (list, x, z, scale, sink = 0.05) => {
    const { h } = field.heightAt(x, z);
    q.setFromAxisAngle(up, rng() * Math.PI * 2);
    list.push(new THREE.Matrix4().compose(new THREE.Vector3(x, h - sink, z), q, new THREE.Vector3(scale, scale, scale)));
  };

  for (let s = 0; s < road.length; s += cfg.propSpacing * (0.5 + rng())) {
    const p = S[road.indexAtS(s)];
    const side = rng() < 0.5 ? -1 : 1;
    const offset = p.width / 2 + 6 + rng() ** 1.6 * 110;
    if (p.sink > 2 && offset < p.width / 2 + 36) continue; // keep the canyon clear
    const rx = -Math.cos(p.heading);
    const rz = Math.sin(p.heading);
    const x = p.x + rx * offset * side + (rng() - 0.5) * 6;
    const z = p.z + rz * offset * side + (rng() - 0.5) * 6;
    // too close to another bit of a winding road?
    if (field.nearest(x, z).dist < p.width / 2 + 4) continue;
    const r = rng();
    if (r < 0.38) place(kinds.saguaro, x, z, 0.8 + rng() * 0.7);
    else if (r < 0.6) place(kinds.barrel, x, z, 0.7 + rng() * 0.6);
    else if (r < 0.88) place(kinds.rock, x, z, 0.5 + rng() * 1.3, 0.2);
    else place(kinds.boulder, x, z, 1.5 + rng() * 2.5, 0.5);
  }

  group.add(instanced(saguaro(), kinds.saguaro));
  group.add(instanced(barrelCactus(), kinds.barrel));
  group.add(instanced(rock(), kinds.rock));
  group.add(instanced(boulder(), kinds.boulder));

  // --- utility poles and sagging wires on the right-hand side
  const poles = [];
  const tops = [];
  for (let s = 10; s < road.length; s += cfg.poleSpacing) {
    const p = S[road.indexAtS(s)];
    if (p.sink > 2) {
      tops.push(null); // break the wire across the canyon
      continue;
    }
    const off = p.width / 2 + 4;
    const x = p.x - Math.cos(p.heading) * off;
    const z = p.z + Math.sin(p.heading) * off;
    if (field.nearest(x, z).dist < p.width / 2 + 2) {
      tops.push(null);
      continue;
    }
    const { h } = field.heightAt(x, z);
    q.setFromAxisAngle(up, p.heading);
    poles.push(m.clone().compose(new THREE.Vector3(x, h - 0.1, z), q, new THREE.Vector3(1, 1, 1)));
    tops.push({ x, y: h - 0.1 + POLE_HEIGHT - 0.38, z, heading: p.heading });
  }
  group.add(instanced(pole(), poles));

  const wire = [];
  for (let i = 1; i < tops.length; i++) {
    const a = tops[i - 1];
    const b = tops[i];
    if (!a || !b) continue;
    for (const k of [-0.85, 0.85]) {
      const ax = a.x - Math.cos(a.heading) * k;
      const az = a.z + Math.sin(a.heading) * k;
      const bx = b.x - Math.cos(b.heading) * k;
      const bz = b.z + Math.sin(b.heading) * k;
      const N = 10;
      for (let j = 0; j < N; j++) {
        for (const t of [j / N, (j + 1) / N]) {
          const sag = Math.sin(t * Math.PI) * 1.1;
          wire.push(ax + (bx - ax) * t, a.y + (b.y - a.y) * t - sag, az + (bz - az) * t);
        }
      }
    }
  }
  const wireGeo = new THREE.BufferGeometry();
  wireGeo.setAttribute('position', new THREE.Float32BufferAttribute(wire, 3));
  group.add(new THREE.LineSegments(wireGeo, new THREE.LineBasicMaterial({ color: PALETTE.wire, transparent: true, opacity: 0.7 })));

  return group;
}
