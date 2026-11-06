/**
 * Every tunable number lives here. Level layouts (src/levels.js) read their
 * difficulty values from this file, so balancing never means touching logic.
 */
export const CONFIG = {
  physics: {
    fixedDt: 1 / 120, // seconds per physics step
    maxSubSteps: 8, // avoid the spiral of death on slow frames
    gravity: 24, // m/s² — heavier than real life for snappier, arcade-y jumps
  },

  car: {
    acceleration: 7, // m/s² until cruise speed is reached
    steerRate: 1.15, // max yaw rate (rad/s) at full lock
    steerAttack: 4.5, // how fast the steering input ramps in (per second)
    steerRelease: 7, // how fast it re-centres
    grip: 9, // how quickly velocity aligns with the car's heading
    airControl: 0.45, // fraction of steering available while airborne
    wheelRadius: 0.38,
    groundStickTolerance: 2, // m/s of "glue" before the car leaves the ground over a crest
    maxVisualRoll: 0.09, // body lean in corners (radians)
    rollFactor: 0.006,
    flipSlipAngle: 0.16, // landing while sideways by more than this (rad)...
    flipImpactSpeed: 9, // ...and harder than this (m/s) = flipped car
    hardLandingSpeed: 5, // landings above this shake the camera and kick up dust
  },

  fail: {
    offRoadMargin: 0, // how far the car's centre may go past the road edge (m)
    elevatedSink: 1.5, // road sections raised more than this have no sand: you fall instead
    fallDepth: 3, // how far below the road you can fall before it counts
    crashScreenDelay: 1.0, // seconds of crash cam before the taunt shows up
  },

  level1: {
    speed: 25, // m/s (~90 km/h)
    roadWidth: 14,
    length: 330,
    drift: 0.006, // rad/s the car creeps to the right, Desert Bus style
  },

  level2: {
    speed: 29, // m/s (~104 km/h)
    roadWidth: 9,
    curveWidth: 7,
    waterfallWidth: 4.8,
    finalCurveWidth: 6,
    curveSharpness: 1.15, // multiplies every curve angle
    downhillGrade: 0.07, // drop per metre on the S-curve descent
    dropSteps: 8,
    dropHeight: 3.2, // height of each ledge in the waterfall
    stepLength: 34,
    lipHeight: 0.5, // little ramp at the end of each ledge that launches the car
    lipLength: 5,
    drift: 0,
  },

  camera: {
    fov: 62,
    fovSpeedBoost: 8, // extra degrees of FOV at cruise speed
    distance: 7.5,
    height: 3.2,
    lookAhead: 6,
    lookHeight: 1.0,
    followSharpness: 6,
    yawSharpness: 4,
    heightSharpness: 3.5,
    shakeDecay: 1.6, // trauma lost per second
    shakeMagnitude: 0.6,
  },

  render: {
    maxPixelRatio: 2,
    mobileMaxPixelRatio: 1.5,
    shadows: true,
    shadowMapSize: 2048,
    fogNear: 60,
    fogFar: 420,
  },

  world: {
    terrainMargin: 260, // sand generated this far around the road (m)
    terrainSpacing: 6, // grid resolution of the terrain (m)
    propSpacing: 9, // average metres of road between roadside props
    poleSpacing: 45,
    seed: 1337,
  },
};
