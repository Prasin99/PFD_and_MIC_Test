/**
 * Single source of tuning constants for the flight plant.
 *
 * Three channels — altitude, heading, speed — each with:
 *   - target the user should hold
 *   - control gain (max rate at full stick)
 *   - first-order rate lag
 *   - disturbance noise (Ornstein–Uhlenbeck) the user must compensate
 *   - tolerance bands (green / yellow) for scoring + visual feedback
 *   - target-drift / jump parameters used by the leg modes
 *
 * Difficulty now controls THREE things, not just one:
 *   1. Disturbance amplitude (`disturbanceSigma`) — how hard the airplane is
 *      to hold steady when the trainee isn't touching the controls.
 *   2. Consistent-drift amplitude + timescale (`consistentDriftSigma`,
 *      `consistentDriftTau`) — how far and how fast the target wanders
 *      around the base value in 'consistent' mode (Medium / Hard levels).
 *   3. Irregular-jump amplitude + cadence (`irregularJumpRange`,
 *      `irregularMin/MaxInterval`) — how big and how often the target snaps
 *      to a new offset in 'irregular' mode (Expert levels).
 *
 * Easy → slowest, smallest range, longest gaps between events.
 * Medium → moderate.
 * Hard → fast, wide range, short gaps.
 * Expert → matches Hard's geometry but uses the 'irregular' jump mode and
 *          adds a bit more disturbance on top.
 */

export const difficultyPresets = {
  easy: {
    // Disturbance (how restless the airplane is at rest)
    altDisturbSigma:  12,   hdgDisturbSigma:  3.0,  spdDisturbSigma:  2.0,
    // Consistent target drift (used by Medium / Hard levels via 'consistent' mode)
    altDriftSigma:    20,   hdgDriftSigma:    3.0,  spdDriftSigma:    1.5,
    altDriftTau:      45,   hdgDriftTau:      35,   spdDriftTau:      30,
    // Irregular target jumps (used by Expert levels via 'irregular' mode)
    altJumpRange:     50,   hdgJumpRange:      7,   spdJumpRange:      5,
    jumpMinInterval:   6,   jumpMaxInterval:  10,
  },
  medium: {
    altDisturbSigma:  25,   hdgDisturbSigma:  5.5,  spdDisturbSigma:  4.0,
    altDriftSigma:    40,   hdgDriftSigma:    6.0,  spdDriftSigma:    2.5,
    altDriftTau:      30,   hdgDriftTau:      22,   spdDriftTau:      22,
    altJumpRange:     75,   hdgJumpRange:     12,   spdJumpRange:      8,
    jumpMinInterval:   4,   jumpMaxInterval:   7,
  },
  hard: {
    altDisturbSigma:  45,   hdgDisturbSigma:  9.0,  spdDisturbSigma:  6.5,
    altDriftSigma:    60,   hdgDriftSigma:   10.0,  spdDriftSigma:    4.0,
    altDriftTau:      20,   hdgDriftTau:      14,   spdDriftTau:      15,
    altJumpRange:    100,   hdgJumpRange:     18,   spdJumpRange:     12,
    jumpMinInterval:   3,   jumpMaxInterval:   5,
  },
  expert: {
    altDisturbSigma:  60,   hdgDisturbSigma: 12.0,  spdDisturbSigma:  9.0,
    altDriftSigma:    80,   hdgDriftSigma:   14.0,  spdDriftSigma:    5.0,
    altDriftTau:      15,   hdgDriftTau:      10,   spdDriftTau:      12,
    altJumpRange:    130,   hdgJumpRange:     22,   spdJumpRange:     16,
    jumpMinInterval:   2,   jumpMaxInterval:   4,
  },
};

/**
 * Visual-smoothing time constant for the consistent-drift output. The OU
 * process produces high-frequency per-step noise (~3 px / frame on the
 * heading tape) that reads as "shaking" to the user. A first-order
 * low-pass filter on the OU output strips that out without changing the
 * drift envelope. Same value used for all channels so the look is
 * consistent across instruments.
 */
const CONSISTENT_DRIFT_SMOOTH_TAU = 1.5; // seconds

export function buildFlightConfig(difficulty = 'medium', overrides = {}) {
  const d = difficultyPresets[difficulty] ?? difficultyPresets.medium;
  return {
    altitude: {
      initial: 8000,
      target: 8000,
      gainPitch: 120,
      rateLag: 1.2,
      disturbanceSigma: d.altDisturbSigma,
      disturbanceTau: 20,
      tolerance: { green: 20, yellow: 50 },
      tapeSpan: 200,
      majorStep: 100,
      minorStep: 10,

      consistentDriftSigma:     d.altDriftSigma,
      consistentDriftTau:       d.altDriftTau,
      consistentDriftSmoothTau: CONSISTENT_DRIFT_SMOOTH_TAU,
      irregularJumpRange:       d.altJumpRange,
      irregularMinInterval:     d.jumpMinInterval,
      irregularMaxInterval:     d.jumpMaxInterval,

      ...overrides.altitude,
    },
    heading: {
      initial: 0,
      target: 0,
      gainRoll: 20,
      rateLag: 0.8,
      // Note: previous versions multiplied this by 1.3 specifically for
      // heading. Removed — it was a stop-gap from earlier tuning that
      // contributed to the channel feeling jumpier than the others.
      disturbanceSigma: d.hdgDisturbSigma,
      disturbanceTau: 8,
      tolerance: { green: 5, yellow: 10 },
      tapeSpan: 35,
      majorStep: 5,
      minorStep: 1,

      consistentDriftSigma:     d.hdgDriftSigma,
      consistentDriftTau:       d.hdgDriftTau,
      consistentDriftSmoothTau: CONSISTENT_DRIFT_SMOOTH_TAU,
      irregularJumpRange:       d.hdgJumpRange,
      irregularMinInterval:     d.jumpMinInterval,
      irregularMaxInterval:     d.jumpMaxInterval,

      ...overrides.heading,
    },
    speed: {
      initial: 150,
      target: 150,
      minThrottleSpeed: 100,
      maxThrottleSpeed: 200,
      initialThrottle: 0.5,
      rateLag: 2.0,
      //pitchDragGain: 10,
      altRateCouplingGain: 0.3,   // kt of speed shift per ft/sec of vSpeed
                            // climb bleeds airspeed, descent builds it
      disturbanceSigma: d.spdDisturbSigma,
      disturbanceTau: 8,
      tolerance: { green: 3, yellow: 7 },
      tapeSpan: 35,
      majorStep: 5,
      minorStep: 1,

      consistentDriftSigma:     d.spdDriftSigma,
      consistentDriftTau:       d.spdDriftTau,
      consistentDriftSmoothTau: CONSISTENT_DRIFT_SMOOTH_TAU,
      irregularJumpRange:       d.spdJumpRange,
      irregularMinInterval:     d.jumpMinInterval,
      irregularMaxInterval:     d.jumpMaxInterval,

      ...overrides.speed,
    },
  };
}