/**
 * Single source of tuning constants for the flight plant.
 *
 * Three channels — altitude, heading, speed — each with:
 *   - target the user should hold
 *   - control gain (max rate at full stick)
 *   - first-order rate lag
 *   - disturbance noise (Ornstein–Uhlenbeck) the user must compensate
 *   - tolerance bands (green / yellow) for scoring + visual feedback
 *
 * Difficulty changes the disturbance amplitude only. All other constants are
 * physical-feel parameters that should stay consistent across modules.
 */

// export const difficultyPresets = {
//   easy:   { altDisturbSigma: 4,  hdgDisturbSigma: 1,   spdDisturbSigma: 1   },
//   medium: { altDisturbSigma: 8,  hdgDisturbSigma: 2,   spdDisturbSigma: 1.5 },
//   hard:   { altDisturbSigma: 14, hdgDisturbSigma: 3.5, spdDisturbSigma: 2.5 },
// };
// export const difficultyPresets = {
//   easy:   { altDisturbSigma: 15, hdgDisturbSigma: 4,  spdDisturbSigma: 3 },
//   medium: { altDisturbSigma: 30, hdgDisturbSigma: 8,  spdDisturbSigma: 6 },
//   hard:   { altDisturbSigma: 50, hdgDisturbSigma: 14, spdDisturbSigma: 10 },
// };

/**
 * Single source of tuning constants for the flight plant.
 */

export const difficultyPresets = {
  easy:   { altDisturbSigma: 8,  hdgDisturbSigma: 2,   spdDisturbSigma: 1.5 },
  medium: { altDisturbSigma: 15, hdgDisturbSigma: 4,   spdDisturbSigma: 3   },
  hard:   { altDisturbSigma: 25, hdgDisturbSigma: 7,   spdDisturbSigma: 5   },
};

export function buildFlightConfig(difficulty = 'medium', overrides = {}) {
  const d = difficultyPresets[difficulty] ?? difficultyPresets.medium;
  return {
    altitude: {
      initial: 8000,
      target: 8000,
      gainPitch: 80,
      rateLag: 1.2,
      disturbanceSigma: d.altDisturbSigma,
      disturbanceTau: 20,
      tolerance: { green: 20, yellow: 50 },
      tapeSpan: 200,
      majorStep: 100,
      minorStep: 10,

      consistentDriftSigma: 40,
      consistentDriftTau: 30,
      irregularJumpRange: 80,
      irregularMinInterval: 3,
      irregularMaxInterval: 7,

      ...overrides.altitude,
    },
    heading: {
      initial: 0,
      target: 0,
      gainRoll: 20,
      rateLag: 0.8,
      disturbanceSigma: d.hdgDisturbSigma,
      disturbanceTau: 15,
      tolerance: { green: 5, yellow: 10 },
      tapeSpan: 35,
      majorStep: 5,
      minorStep: 1,

      consistentDriftSigma: 8,
      consistentDriftTau: 20,
      irregularJumpRange: 15,
      irregularMinInterval: 3,
      irregularMaxInterval: 6,

      ...overrides.heading,
    },
    speed: {
  initial: 150,
  target: 150,
  minThrottleSpeed: 100,
  maxThrottleSpeed: 200,
  initialThrottle: 0.5,
  rateLag: 2.0,
  pitchDragGain: 10,
  disturbanceSigma: d.spdDisturbSigma,
  disturbanceTau: 15,
  tolerance: { green: 3, yellow: 7 },
  tapeSpan: 35,
  majorStep: 5,
  minorStep: 1,

  // Needed for Level 10 style "follow airspeed instructions"
  consistentDriftSigma: 3,
  consistentDriftTau: 18,
  irregularJumpRange: 12,
  irregularMinInterval: 4,
  irregularMaxInterval: 8,

  ...overrides.speed,
},
  };
}
