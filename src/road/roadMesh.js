import * as THREE from 'three';
import { PALETTE } from '../palette.js';

const TEX_REPEAT = 12; // metres of road per texture tile

/** Asphalt texture with edge lines and a dashed centre line, drawn on a canvas. */
function createRoadTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#' + new THREE.Color(PALETTE.asphalt).getHexString();
  g.fillRect(0, 0, c.width, c.height);
  // grain
  for (let i = 0; i < 2600; i++) {
    const v = 40 + Math.random() * 40;
    g.fillStyle = `rgba(${v + 20},${v},${v + 8},0.35)`;
    g.fillRect(Math.random() * c.width, Math.random() * c.height, 2, 2);
  }
  const line = '#' + new THREE.Color(PALETTE.roadLine).getHexString();
  g.fillStyle = line;
  g.fillRect(14, 0, 8, c.height);
  g.fillRect(c.width - 22, 0, 8, c.height);
  g.fillRect(c.width / 2 - 4, 0, 8, c.height * 0.5);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function edgePoints(p) {
  const rx = -Math.cos(p.heading);
  const rz = Math.sin(p.heading);
  const hw = p.width / 2;
  return { lx: p.x - rx * hw, lz: p.z - rz * hw, rx: p.x + rx * hw, rz: p.z + rz * hw };
}

/** Road surface (textured ribbon) + side walls dropping to the ground/canyon. */
export function createRoadMesh(road) {
  const S = road.samples;
  const group = new THREE.Group();

  // --- surface
  const pos = [];
  const uv = [];
  const idx = [];
  S.forEach((p, i) => {
    const e = edgePoints(p);
    pos.push(e.lx, p.y, e.lz, e.rx, p.y, e.rz);
    const v = p.s / TEX_REPEAT;
    uv.push(0, v, 1, v);
    if (i > 0) {
      const a = (i - 1) * 2;
      const b = i * 2;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  });
  const surf = new THREE.BufferGeometry();
  surf.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  surf.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  surf.setIndex(idx);
  surf.computeVertexNormals();
  const surface = new THREE.Mesh(
    surf,
    new THREE.MeshStandardMaterial({ map: createRoadTexture(), roughness: 0.95, metalness: 0 }),
  );
  surface.receiveShadow = true;
  group.add(surface);

  // --- side walls (and ledge faces in the waterfall)
  const wp = [];
  const wc = [];
  const top = new THREE.Color(PALETTE.roadEdge);
  const bottom = new THREE.Color(PALETTE.canyonDeep);
  const pushQuad = (ax, ay, az, bx, by, bz, depthA, depthB) => {
    // quad from top edge a→b down by depth
    const verts = [
      [ax, ay, az, top],
      [bx, by, bz, top],
      [ax, ay - depthA, az, bottom],
      [bx, by, bz, top],
      [bx, by - depthB, bz, bottom],
      [ax, ay - depthA, az, bottom],
    ];
    for (const [x, y, z, col] of verts) {
      wp.push(x, y, z);
      wc.push(col.r, col.g, col.b);
    }
  };
  for (let i = 1; i < S.length; i++) {
    const a = S[i - 1];
    const b = S[i];
    const ea = edgePoints(a);
    const eb = edgePoints(b);
    const da = 0.6 + a.sink;
    const db = 0.6 + b.sink;
    pushQuad(ea.lx, a.y, ea.lz, eb.lx, b.y, eb.lz, da, db); // left wall
    pushQuad(eb.rx, b.y, eb.rz, ea.rx, a.y, ea.rz, db, da); // right wall
  }
  const walls = new THREE.BufferGeometry();
  walls.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3));
  walls.setAttribute('color', new THREE.Float32BufferAttribute(wc, 3));
  walls.computeVertexNormals();
  const wallMesh = new THREE.Mesh(
    walls,
    new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, side: THREE.DoubleSide }),
  );
  wallMesh.receiveShadow = true;
  wallMesh.castShadow = true;
  group.add(wallMesh);

  group.add(createFinishLine(road));
  return group;
}

function createFinishLine(road) {
  const p = road.samples[road.finishIndex];
  const g = new THREE.Group();
  g.position.set(p.x, p.y, p.z);
  g.rotation.y = p.heading;

  // checkered strip
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 32;
  const ctx = c.getContext('2d');
  for (let x = 0; x < 16; x++)
    for (let y = 0; y < 2; y++) {
      ctx.fillStyle = (x + y) % 2 ? '#111' : '#f5efe0';
      ctx.fillRect(x * 16, y * 16, 16, 16);
    }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(p.width, 2), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
  strip.rotation.x = -Math.PI / 2;
  strip.position.y = 0.02;
  strip.receiveShadow = true;
  g.add(strip);

  // arch: two posts + banner
  const postMat = new THREE.MeshStandardMaterial({ color: PALETTE.carTrim, flatShading: true });
  const half = p.width / 2 + 0.8;
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.4, 6, 0.4), postMat);
    post.position.set(side * half, 3, 0);
    post.castShadow = true;
    g.add(post);
  }
  const bc = document.createElement('canvas');
  bc.width = 512;
  bc.height = 96;
  const b = bc.getContext('2d');
  b.fillStyle = '#c4462f';
  b.fillRect(0, 0, 512, 96);
  b.fillStyle = '#f5efe0';
  b.font = 'bold 64px system-ui, sans-serif';
  b.textAlign = 'center';
  b.textBaseline = 'middle';
  b.fillText('FINISH', 256, 52);
  const btex = new THREE.CanvasTexture(bc);
  btex.colorSpace = THREE.SRGBColorSpace;
  const banner = new THREE.Mesh(
    new THREE.BoxGeometry(half * 2 + 0.4, 1.2, 0.2),
    [postMat, postMat, postMat, postMat, new THREE.MeshStandardMaterial({ map: btex }), new THREE.MeshStandardMaterial({ map: btex })],
  );
  banner.position.y = 5.6;
  banner.castShadow = true;
  g.add(banner);
  return g;
}
