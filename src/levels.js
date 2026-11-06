import { CONFIG } from './config.js';

/**
 * Levels are plain data: a list of road segments laid end to end.
 *
 * Segment types
 *   straight  { length }
 *   slope     { length, grade }            grade = rise per metre (negative = downhill)
 *   curve     { length, angle, grade? }    angle in degrees, positive = right turn
 *   drop      { steps, stepLength, stepHeight, lipHeight, lipLength }
 *                                          "waterfall": flat ledges, each ending in a small lip
 *
 * Optional on any segment
 *   width  road width (blends in over the first metres of the segment)
 *   sink   how far the ground sits below the road (> CONFIG.fail.elevatedSink = canyon, no sand)
 *
 * The finish line is placed at the end of the last segment. A run-out
 * straight is added after it automatically.
 */
export function getLevels() {
  const L1 = CONFIG.level1;
  const L2 = CONFIG.level2;
  const sharp = L2.curveSharpness;
  const g = -L2.downhillGrade;

  return [
    {
      id: 1,
      title: 'Level 1',
      subtitle: 'Just drive.',
      speed: L1.speed,
      drift: L1.drift,
      segments: [{ type: 'straight', length: L1.length, width: L1.roadWidth }],
    },
    {
      id: 2,
      title: 'Level 2',
      subtitle: 'Same road. Basically.',
      speed: L2.speed,
      drift: L2.drift,
      segments: [
        { type: 'straight', length: 140, width: L2.roadWidth },

        // 1. S-curves on a downhill slope: left, right, left, right
        { type: 'curve', length: 80, angle: -65 * sharp, grade: g, width: L2.curveWidth },
        { type: 'curve', length: 115, angle: 110 * sharp, grade: g },
        { type: 'curve', length: 115, angle: -110 * sharp, grade: g },
        { type: 'curve', length: 80, angle: 65 * sharp, grade: g },

        // 2. The waterfall: the road narrows over a canyon and falls in ledges
        { type: 'slope', length: 60, grade: g * 0.5, width: L2.waterfallWidth, sink: 14 },
        {
          type: 'drop',
          steps: L2.dropSteps,
          stepLength: L2.stepLength,
          stepHeight: L2.dropHeight,
          lipHeight: L2.lipHeight,
          lipLength: L2.lipLength,
          sink: 16,
        },
        { type: 'straight', length: 40, sink: 14 },

        // 3. More S-curves, tighter and narrower
        { type: 'curve', length: 75, angle: 80 * sharp, width: L2.finalCurveWidth, sink: 0 },
        { type: 'curve', length: 90, angle: -120 * sharp },
        { type: 'curve', length: 90, angle: 120 * sharp },
        { type: 'curve', length: 75, angle: -80 * sharp },

        // 4. Finish
        { type: 'straight', length: 70, width: L2.roadWidth },
      ],
    },
  ];
}
