// Headless check: can an autopilot finish every level, and does doing nothing fail?
// Run with `npm run simulate`.
import { CONFIG } from '../src/config.js';
import { getLevels } from '../src/levels.js';
import { RoadPath } from '../src/road/roadPath.js';
import { ArcadeVehicle } from '../src/physics/vehicle.js';
import { autopilotSteer } from '../src/physics/autopilot.js';

function run(level, driver) {
  const road = new RoadPath(level.segments);
  const v = new ArcadeVehicle(CONFIG.car, CONFIG.fail, CONFIG.physics.gravity);
  v.reset(road.samples[2], 2);
  const dt = CONFIG.physics.fixedDt;
  let t = 0;
  let jumps = 0;
  let maxImpact = 0;
  while (t < 300) {
    v.step(dt, { steer: driver(v, road) }, road, level);
    t += dt;
    for (const e of v.events) {
      if (e.type === 'takeoff') jumps++;
      if (e.type === 'land') maxImpact = Math.max(maxImpact, e.impact);
    }
    v.events.length = 0;
    if (v.crashed) return { result: `CRASH (${v.crashReason})`, s: v.s.toFixed(0), t: t.toFixed(1), jumps };
    if (v.s >= road.finishS) return { result: 'FINISH', s: v.s.toFixed(0), t: t.toFixed(1), jumps, maxImpact: maxImpact.toFixed(1) };
  }
  return { result: 'TIMEOUT', s: v.s.toFixed(0) };
}

let ok = true;
for (const level of getLevels()) {
  const auto = run(level, autopilotSteer);
  const idle = run(level, () => 0);
  console.log(`Level ${level.id}  autopilot:`, auto, '  hands-off:', idle);
  if (auto.result !== 'FINISH') ok = false;
}
process.exit(ok ? 0 : 1);
