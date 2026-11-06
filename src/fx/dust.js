import * as THREE from 'three';
import { PALETTE } from '../palette.js';

/** Pooled soft dust puffs, rendered as one Points draw call. */
export class Dust {
  constructor(max = 600) {
    this.max = max;
    this.next = 0;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max); // remaining
    this.maxLife = new Float32Array(max).fill(1);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo = geo;

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { color: { value: new THREE.Color(PALETTE.sandLight) }, scale: { value: 400 } },
      vertexShader: /* glsl */ `
        attribute float size; attribute float alpha;
        uniform float scale; varying float vAlpha;
        void main() {
          vAlpha = alpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * scale / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 color; varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d) * vAlpha;
          if (a < 0.01) discard;
          gl_FragColor = vec4(color, a);
          #include <colorspace_fragment>
        }`,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.material = mat;
  }

  setViewportHeight(h) {
    this.material.uniforms.scale.value = h * 0.5;
  }

  emit(p, { spread = 0.4, up = 1.2, back = null, life = 1.1, size = 1.1 } = {}) {
    const i = this.next;
    this.next = (this.next + 1) % this.max;
    this.pos.set([p.x + (Math.random() - 0.5) * spread, p.y + 0.1, p.z + (Math.random() - 0.5) * spread], i * 3);
    const bx = back ? back.x : 0;
    const bz = back ? back.z : 0;
    this.vel.set([bx + (Math.random() - 0.5) * 2, up * (0.4 + Math.random()), bz + (Math.random() - 0.5) * 2], i * 3);
    this.life[i] = this.maxLife[i] = life * (0.7 + Math.random() * 0.6);
    this.size[i] = size;
  }

  burst(p, count, opts) {
    for (let i = 0; i < count; i++) this.emit(p, opts);
  }

  clear() {
    this.life.fill(0);
    this.alpha.fill(0);
  }

  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) {
        this.alpha[i] = 0;
        continue;
      }
      this.life[i] -= dt;
      const k = i * 3;
      const drag = Math.exp(-1.8 * dt);
      this.vel[k] *= drag;
      this.vel[k + 2] *= drag;
      this.vel[k + 1] = this.vel[k + 1] * drag - 0.4 * dt;
      this.pos[k] += this.vel[k] * dt;
      this.pos[k + 1] += this.vel[k + 1] * dt;
      this.pos[k + 2] += this.vel[k + 2] * dt;
      const t = 1 - this.life[i] / this.maxLife[i]; // 0 → 1
      this.size[i] += dt * 1.6;
      this.alpha[i] = Math.sin(Math.min(1, t * 1.4) * Math.PI) * 0.45 * (1 - t);
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.size.needsUpdate = true;
    this.geo.attributes.alpha.needsUpdate = true;
  }
}
