/**
 * A simple driver used by the headless simulation (and ?autopilot in the
 * browser) to prove each level is beatable with the current config.
 */
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function autopilotSteer(vehicle, road) {
  if (!vehicle.grounded) return 0; // never steer in the air
  const ahead = road.samples[road.indexAtS(vehicle.s + 12)];
  const headingError = wrap(ahead.heading - vehicle.velYaw); // > 0: road bends left
  const steer = -vehicle.d * 0.35 - headingError * 3;
  return Math.max(-1, Math.min(1, steer));
}
