/**
 * All sound is synthesized with WebAudio, no files. Engine hum (pitch follows
 * speed), desert wind, crash, landing thump, and two jingles.
 * The context is created lazily on the first user gesture (browser autoplay rules).
 */
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  init() {
    if (this.ctx) {
      this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());

    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    const comp = ctx.createDynamicsCompressor();
    this.master.connect(comp).connect(ctx.destination);

    this.noise = this.#noiseBuffer(2);

    // engine: detuned saw + square + sub, through a lowpass that opens with speed
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 400;
    this.engineFilter.Q.value = 3;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineFilter.connect(this.engineGain).connect(this.master);
    this.engineOscs = [
      ['sawtooth', 1, 0.5],
      ['square', 1.005, 0.18],
      ['sine', 0.5, 0.7],
    ].map(([type, ratio, gain]) => {
      const o = ctx.createOscillator();
      o.type = type;
      const g = ctx.createGain();
      g.gain.value = gain;
      o.connect(g).connect(this.engineFilter);
      o.start();
      return { o, ratio };
    });

    // wind: looping noise through a slowly wandering bandpass
    const wind = ctx.createBufferSource();
    wind.buffer = this.noise;
    wind.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 500;
    band.Q.value = 0.7;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.05;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 250;
    lfo.connect(lfoGain).connect(band.frequency);
    wind.connect(band).connect(windGain).connect(this.master);
    wind.start();
    lfo.start();
  }

  #noiseBuffer(seconds) {
    const ctx = this.ctx;
    const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }

  /** speedNorm 0..1, on = engine running. */
  setEngine(speedNorm, grounded, on) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const base = 42 + speedNorm * 70 + (grounded ? 0 : 18);
    for (const { o, ratio } of this.engineOscs) o.frequency.setTargetAtTime(base * ratio, t, 0.12);
    this.engineFilter.frequency.setTargetAtTime(280 + speedNorm * 1100 + (grounded ? 0 : 400), t, 0.1);
    this.engineGain.gain.setTargetAtTime(on ? 0.07 + speedNorm * 0.07 : 0, t, on ? 0.2 : 0.08);
  }

  #noiseHit({ duration, gain, from, to, delay = 0 }) {
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(to, t + duration);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random());
    src.stop(t + duration + 0.05);
  }

  #thump(freq, gain, duration) {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 0.3, t + duration);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + duration + 0.05);
  }

  crash() {
    if (!this.ctx) return;
    this.#thump(110, 0.9, 0.45);
    this.#noiseHit({ duration: 0.9, gain: 0.8, from: 3000, to: 120 });
    this.#noiseHit({ duration: 0.4, gain: 0.35, from: 5000, to: 800, delay: 0.18 });
  }

  land(intensity) {
    if (!this.ctx) return;
    const k = Math.min(1, intensity / 14);
    this.#thump(90, 0.25 + k * 0.5, 0.25);
    this.#noiseHit({ duration: 0.25, gain: 0.1 + k * 0.3, from: 1800, to: 200 });
  }

  #notes(notes, type = 'triangle', gain = 0.22) {
    const ctx = this.ctx;
    const t0 = ctx.currentTime + 0.05;
    for (const [freq, start, dur, slideTo] of notes) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(freq, t0 + start);
      if (slideTo) o.frequency.linearRampToValueAtTime(slideTo, t0 + start + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t0 + start);
      g.gain.linearRampToValueAtTime(gain, t0 + start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + start + dur);
      o.connect(g).connect(this.master);
      o.start(t0 + start);
      o.stop(t0 + start + dur + 0.05);
    }
  }

  /** Short chime when a level is cleared. */
  levelJingle() {
    if (!this.ctx) return;
    this.#notes([
      [659.25, 0, 0.25],
      [987.77, 0.12, 0.5],
    ]);
  }

  /** Triumphant fanfare... that deflates. */
  finishJingle() {
    if (!this.ctx) return;
    this.#notes([
      [523.25, 0, 0.18],
      [659.25, 0.14, 0.18],
      [783.99, 0.28, 0.18],
      [1046.5, 0.42, 0.7],
    ]);
    this.#notes(
      [
        [311.13, 1.4, 0.35],
        [293.66, 1.8, 0.35],
        [277.18, 2.2, 0.35],
        [261.63, 2.6, 1.1, 220],
      ],
      'sawtooth',
      0.08,
    );
  }
}
