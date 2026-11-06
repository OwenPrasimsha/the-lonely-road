/** Fixed-timestep accumulator. Returns the interpolation alpha for rendering. */
export class FixedStepper {
  constructor(dt, maxSubSteps) {
    this.dt = dt;
    this.maxSubSteps = maxSubSteps;
    this.acc = 0;
  }

  reset() {
    this.acc = 0;
  }

  advance(frameDt, step) {
    this.acc += frameDt;
    let n = 0;
    while (this.acc >= this.dt && n < this.maxSubSteps) {
      step(this.dt);
      this.acc -= this.dt;
      n++;
    }
    if (n === this.maxSubSteps) this.acc = 0; // fell behind: drop the backlog
    return this.acc / this.dt;
  }
}
