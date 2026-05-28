/**
 * MIC tunable parameters + channel-config builder for flightDynamics.
 */

export const MIC_CONFIG = {
  initial: { 
    heading: 0, 
    altitude: 10000, 
    airspeed: 150,        // ← was 200, change to 150
    throttle: 0.5 
  },

  tolerance: {
    heading:  { green: 5,   yellow: 10  },
    altitude: { green: 50,  yellow: 100 },
    airspeed: { green: 5,   yellow: 10  },
  },

 listening: {
  numberRange: [1, 9],         // was [1, 99]  — single digits only
  intervalMs: 6000,            // was 1800     — longer pause between numbers
  responseWindowMs: 2800,      // was 1500     — more time to react
  voiceLang: 'en-US',
  voiceRate: 0.8,              // new — slightly slower speech
},
};

/**
 * Build the per-channel cfg object passed to stepFlight() / createFlightState().
 * Tune these against your screen recordings.
 */
export function buildMICChannelConfig() {
  return {
    altitude: {
      initial: MIC_CONFIG.initial.altitude,
      target:  MIC_CONFIG.initial.altitude,
      gainPitch: 200,
      rateLag: 0.6,
      disturbanceBias:  -60,    // ← ADD THIS LINE
      disturbanceSigma: 0.5,
      disturbanceTau:   5,
      consistentDriftSigma: 200,
      consistentDriftTau:   12,
      consistentDriftSmoothTau: 1.5,
      irregularJumpRange: 250,
      irregularMinInterval: 3,
      irregularMaxInterval: 7,
      irregularSmoothTau: 0,
    },
    heading: {
      initial: MIC_CONFIG.initial.heading,
      target:  MIC_CONFIG.initial.heading,
      gainRoll: 50,
      rateLag: 0.5,  
      disturbanceBias:  -16,    // deg/sec → slow steady right turn (positive = heading increasing)

      disturbanceSigma: 0.3,
      disturbanceTau:   5,
      consistentDriftSigma: 20,
      consistentDriftTau:   12,
      consistentDriftSmoothTau: 1.5,
      irregularJumpRange: 25,
      irregularMinInterval: 3,
      irregularMaxInterval: 7,
      irregularSmoothTau: 0,
    },
    speed: {
      initial: MIC_CONFIG.initial.airspeed,
      target:  MIC_CONFIG.initial.airspeed,
      initialThrottle:  MIC_CONFIG.initial.throttle,
      minThrottleSpeed: 100,
      maxThrottleSpeed: 260,
      altRateCouplingGain: 0.8,
      rateLag: 1.5,
        disturbanceBias:  0,      // no drift — speed stays put unless user touches throttle

      disturbanceSigma: 1.5,
      disturbanceTau:   5,
      consistentDriftSigma: 10,
      consistentDriftTau:   12,
      consistentDriftSmoothTau: 1.5,
      irregularJumpRange: 15,
      irregularMinInterval: 3,
      irregularMaxInterval: 7,
      irregularSmoothTau: 0,
    },
  };
}