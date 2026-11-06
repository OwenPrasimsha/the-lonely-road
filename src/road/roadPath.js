/**
 * RoadPath turns a list of level segments into a dense centre-line of samples
 * and answers "where am I relative to the road?" queries for the physics.
 * Pure math: no Three.js, so it also runs in Node (see scripts/simulate.mjs).
 *
 * Coordinate convention: heading 0 drives toward +Z, forward = (sin h, cos h),
 * right = (-cos h, sin h). Positive lateral offset `d` means right of centre.
 */
const STEP = 1; // metres between samples
const RUNOUT = 220; // straight road after the finish line
const WIDTH_BLEND = 25; // metres over which width changes ease in

const deg = (a) => (a * Math.PI) / 180;
const smooth = (t) => t * t * (3 - 2 * t);

export class RoadPath {
  constructor(segments) {
    this.samples = [];
    this.#build(segments);
  }

  #build(segments) {
    const st = { x: 0, y: 0, z: 0, h: 0, s: 0, w: segments[0].width ?? 10, sink: segments[0].sink ?? 0 };
    const push = (extra = {}) =>
      this.samples.push({ s: st.s, x: st.x, y: st.y, z: st.z, heading: st.h, width: st.w, sink: st.sink, grade: 0, ...extra });
    push();

    const advance = (ds, turn) => {
      st.h += turn * 0.5;
      st.x += Math.sin(st.h) * ds;
      st.z += Math.cos(st.h) * ds;
      st.h += turn * 0.5;
      st.s += ds;
    };

    const runSegment = (seg) => {
      const startW = st.w;
      const targetW = seg.width ?? st.w;
      if (seg.sink !== undefined) st.sink = seg.sink;
      const blend = (travelled, len) => {
        const t = Math.min(1, travelled / Math.min(WIDTH_BLEND, len));
        st.w = startW + (targetW - startW) * smooth(t);
      };

      if (seg.type === 'drop') {
        const total = seg.steps * seg.stepLength;
        let travelled = 0;
        for (let k = 0; k < seg.steps; k++) {
          const base = st.y;
          const n = Math.ceil(seg.stepLength / STEP);
          const ds = seg.stepLength / n;
          const lipStart = seg.stepLength - seg.lipLength;
          for (let i = 1; i <= n; i++) {
            const dist = i * ds;
            travelled += ds;
            advance(ds, 0);
            const lip = dist > lipStart ? smooth((dist - lipStart) / seg.lipLength) * seg.lipHeight : 0;
            st.y = base + lip;
            blend(travelled, total);
            push();
          }
          // the ledge: a second sample at the same spot, lower down
          this.samples[this.samples.length - 1].edge = true;
          st.y = base - seg.stepHeight;
          push({ ledgeFoot: true });
        }
        return;
      }

      const len = seg.length;
      const n = Math.max(1, Math.ceil(len / STEP));
      const ds = len / n;
      const turn = -deg(seg.angle ?? 0) / n; // positive angle = right turn = heading decreases
      const grade = seg.grade ?? 0;
      for (let i = 1; i <= n; i++) {
        advance(ds, turn);
        st.y += grade * ds;
        blend(i * ds, len);
        push();
      }
    };

    for (const seg of segments) runSegment(seg);
    this.finishIndex = this.samples.length - 1;
    this.finishS = st.s;
    runSegment({ type: 'straight', length: RUNOUT });
    this.length = st.s;

    // per-sample grade, and smoothed sink so the canyon walls ease in
    const S = this.samples;
    for (let i = 1; i < S.length; i++) {
      const ds = S[i].s - S[i - 1].s;
      S[i].grade = ds > 1e-6 ? (S[i].y - S[i - 1].y) / ds : S[i - 1].grade;
    }
    S[0].grade = S[1].grade;
    const raw = S.map((p) => p.sink);
    const R = 18;
    for (let i = 0; i < S.length; i++) {
      let sum = 0;
      let cnt = 0;
      for (let j = Math.max(0, i - R); j <= Math.min(S.length - 1, i + R); j++) {
        sum += raw[j];
        cnt++;
      }
      // never let smoothing lower a raised section (the ledges must stay over the canyon)
      S[i].sink = Math.max(sum / cnt, raw[i] * 0.85);
    }
  }

  /** Index of the closest sample, searching the whole road. Use after teleports. */
  nearestIndex(x, z) {
    let best = Infinity;
    let bi = 0;
    for (let i = 0; i < this.samples.length; i++) {
      const p = this.samples[i];
      const d = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (d < best) {
        best = d;
        bi = i;
      }
    }
    return bi;
  }

  /** Sample index at distance s along the road (binary search). */
  indexAtS(s) {
    const S = this.samples;
    let lo = 0;
    let hi = S.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (S[mid].s <= s) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  /**
   * Project a world XZ position onto the road near sample `hint`.
   * Fills and returns `out` = { index, s, d, y, grade, width, sink, heading }.
   */
  query(x, z, hint = 0, out = {}) {
    const S = this.samples;
    const lo = Math.max(0, hint - 40);
    const hi = Math.min(S.length - 2, hint + 80);
    let best = Infinity;
    let bi = lo;
    let bt = 0;
    for (let i = lo; i <= hi; i++) {
      const a = S[i];
      const b = S[i + 1];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const L2 = dx * dx + dz * dz;
      if (L2 < 1e-8) continue; // ledge (vertical) — not a drivable span
      let t = ((x - a.x) * dx + (z - a.z) * dz) / L2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const px = a.x + dx * t - x;
      const pz = a.z + dz * t - z;
      const dist = px * px + pz * pz;
      if (dist < best) {
        best = dist;
        bi = i;
        bt = t;
      }
    }
    const a = S[bi];
    const b = S[bi + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const L = Math.hypot(dx, dz) || 1;
    const fx = dx / L;
    const fz = dz / L;
    const px = a.x + dx * bt;
    const pz = a.z + dz * bt;
    out.index = bi;
    out.s = a.s + (b.s - a.s) * bt;
    out.d = (x - px) * -fz + (z - pz) * fx;
    out.y = a.y + (b.y - a.y) * bt;
    out.grade = (b.y - a.y) / L;
    out.width = a.width + (b.width - a.width) * bt;
    out.sink = a.sink + (b.sink - a.sink) * bt;
    out.heading = Math.atan2(fx, fz);
    return out;
  }
}
