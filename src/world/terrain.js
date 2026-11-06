import * as THREE from 'three';
import { fbm } from './noise.js';
import { PALETTE } from '../palette.js';

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Desert height field derived from the road: flat under the road, rolling
 * dunes further out, and a canyon wherever a road section has `sink`.
 */
export class TerrainField {
  constructor(road) {
    this.road = road;
    this.S = road.samples;
  }

  /** Nearest road sample to (x, z): coarse scan, then local refine. */
  nearest(x, z) {
    const S = this.S;
    let best = Infinity;
    let bi = 0;
    for (let i = 0; i < S.length; i += 8) {
      const d = (S[i].x - x) ** 2 + (S[i].z - z) ** 2;
      if (d < best) {
        best = d;
        bi = i;
      }
    }
    const lo = Math.max(0, bi - 8);
    const hi = Math.min(S.length - 1, bi + 8);
    for (let i = lo; i <= hi; i++) {
      const d = (S[i].x - x) ** 2 + (S[i].z - z) ** 2;
      if (d < best) {
        best = d;
        bi = i;
      }
    }
    return { sample: S[bi], dist: Math.sqrt(best) };
  }

  /** Height and a 0..1 "canyon-ness" for colouring. */
  heightAt(x, z) {
    const { sample: p, dist } = this.nearest(x, z);
    const edge = p.width / 2;
    const dunes = (fbm(x * 0.012, z * 0.012, 4) - 0.35) * 16 + fbm(x * 0.06, z * 0.06, 2) * 1.4;
    const rise = smoothstep(edge + 3, edge + 70, dist);
    // canyon: deep next to the road, shallower far away, but always below it
    const depth = Math.min(1, p.sink / 10);
    const canyonWall = 1 - 0.55 * smoothstep(edge + 12, edge + 120, dist);
    const canyon = depth * (1 - smoothstep(edge + 4, edge + 70, dist));
    let h = p.y - 0.15 - p.sink * canyonWall + rise * Math.max(dunes, -2) * (1 - 0.6 * depth);
    if (dist < edge + 1) h = Math.min(h, p.y - 0.6 - p.sink);
    return { h, canyon };
  }
}

export function createTerrainMesh(field, cfg) {
  const S = field.S;
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of S) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  }
  const m = cfg.terrainMargin;
  const step = cfg.terrainSpacing;
  const nx = Math.ceil((maxX - minX + 2 * m) / step);
  const nz = Math.ceil((maxZ - minZ + 2 * m) / step);
  const x0 = minX - m;
  const z0 = minZ - m;

  const sand = new THREE.Color(PALETTE.sand);
  const sandDark = new THREE.Color(PALETTE.sandDark);
  const sandLight = new THREE.Color(PALETTE.sandLight);
  const canyonCol = new THREE.Color(PALETTE.canyon);
  const tmp = new THREE.Color();

  const heights = new Float32Array((nx + 1) * (nz + 1));
  const canyons = new Float32Array((nx + 1) * (nz + 1));
  for (let j = 0; j <= nz; j++)
    for (let i = 0; i <= nx; i++) {
      const r = field.heightAt(x0 + i * step, z0 + j * step);
      heights[j * (nx + 1) + i] = r.h;
      canyons[j * (nx + 1) + i] = r.canyon;
    }

  // Non-indexed triangles with per-face colour = crisp low-poly facets.
  const pos = new Float32Array(nx * nz * 18);
  const col = new Float32Array(nx * nz * 18);
  let o = 0;
  const vert = (i, j) => {
    const k = j * (nx + 1) + i;
    return [x0 + i * step, heights[k], z0 + j * step, canyons[k]];
  };
  const face = (a, b, c) => {
    const avgH = (a[1] + b[1] + c[1]) / 3;
    const cy = (a[3] + b[3] + c[3]) / 3;
    const n = fbm(a[0] * 0.05, a[2] * 0.05, 1);
    tmp.copy(sandDark).lerp(sand, n).lerp(sandLight, Math.max(0, n - 0.6));
    tmp.lerp(canyonCol, Math.min(1, cy * 1.2));
    for (const v of [a, b, c]) {
      pos[o] = v[0];
      pos[o + 1] = v[1];
      pos[o + 2] = v[2];
      col[o] = tmp.r;
      col[o + 1] = tmp.g;
      col[o + 2] = tmp.b;
      o += 3;
    }
    return avgH;
  };
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const a = vert(i, j);
      const b = vert(i + 1, j);
      const c = vert(i, j + 1);
      const d = vert(i + 1, j + 1);
      face(a, c, b);
      face(b, c, d);
    }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }));
  mesh.receiveShadow = true;
  return mesh;
}
