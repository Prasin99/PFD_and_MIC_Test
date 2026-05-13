// /**
//  * Compensatory tracking plant.
//  *
//  *   pitch input  → vSpeed command  → altitude (via first-order lag, then ∫)
//  *   roll  input  → headingRate cmd → heading  (first-order lag, then ∫, wrap 360°)
//  *   throttle     → equilibrium spd → speed    (first-order lag toward equilibrium)
//  *
//  * Each channel adds Ornstein–Uhlenbeck disturbance to its rate command, which
//  * is what makes this a tracking task — without disturbance the aircraft would
//  * sit at trim. `active` flags pause disturbance per channel (used when the
//  * current "leg" marks an instrument inactive).
//  */

// export function createFlightState(cfg) {
//   return {
//     altitude: cfg.altitude.initial,
//     vSpeed: 0,
//     heading: cfg.heading.initial,
//     headingRate: 0,
//     speed: cfg.speed.initial,
//     throttle: cfg.speed.initialThrottle,
//     distVSpeed: 0,
//     distHdgRate: 0,
//     distSpeed: 0,
//   };
// }

// /**
//  * Step physics by `dt` seconds. Mutates `state` in place.
//  *
//  * @param state    Object from createFlightState
//  * @param inputs   { pitch: -1..1, roll: -1..1, throttle: 0..1 }
//  * @param active   { altitude: bool, heading: bool, speed: bool }
//  * @param cfg      Output of buildFlightConfig
//  * @param dt       seconds (typ. 1/60)
//  * @param rng      function returning uniform [0,1) — pass Math.random for now
//  */
// export function stepFlight(state, inputs, active, cfg, dt, rng) {
//   // --- Disturbance (OU noise) ---
//   state.distVSpeed = active.altitude
//     ? ouStep(state.distVSpeed, cfg.altitude.disturbanceSigma, cfg.altitude.disturbanceTau, dt, rng)
//     : 0;
//   state.distHdgRate = active.heading
//     ? ouStep(state.distHdgRate, cfg.heading.disturbanceSigma, cfg.heading.disturbanceTau, dt, rng)
//     : 0;
//   state.distSpeed = active.speed
//     ? ouStep(state.distSpeed, cfg.speed.disturbanceSigma, cfg.speed.disturbanceTau, dt, rng)
//     : 0;

//   // --- Altitude ---
//   const vSpeedCmd = cfg.altitude.gainPitch * clampPM1(inputs.pitch) + state.distVSpeed;
//   state.vSpeed += (vSpeedCmd - state.vSpeed) * (dt / cfg.altitude.rateLag);
//   state.altitude += state.vSpeed * dt;

//   // --- Heading ---
//   const hdgRateCmd = cfg.heading.gainRoll * clampPM1(inputs.roll) + state.distHdgRate;
//   state.headingRate += (hdgRateCmd - state.headingRate) * (dt / cfg.heading.rateLag);
//   state.heading = wrap360(state.heading + state.headingRate * dt);

//   // --- Speed ---
//   state.throttle = clamp01(inputs.throttle);
//   const eq = cfg.speed.minThrottleSpeed +
//     (cfg.speed.maxThrottleSpeed - cfg.speed.minThrottleSpeed) * state.throttle;
//   const speedCmd = eq + state.distSpeed;
//   state.speed += (speedCmd - state.speed) * (dt / cfg.speed.rateLag);
// }

// function ouStep(x, sigma, tau, dt, rng) {
//   const decay = Math.exp(-dt / tau);
//   return x * decay + sigma * Math.sqrt(1 - decay * decay) * gaussian(rng);
// }

// function gaussian(rng) {
//   const u = Math.max(rng(), 1e-9);
//   const v = rng();
//   return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
// }

// function wrap360(a) { let x = a % 360; if (x < 0) x += 360; return x; }
// function clamp01(x) { return Math.max(0, Math.min(1, x)); }
// function clampPM1(x) { return Math.max(-1, Math.min(1, x)); }

// /** Smallest signed angular difference (a - b) in (-180, 180]. */
// export function angularDiff(a, b) {
//   return ((a - b) % 360 + 540) % 360 - 180;
// }


/**
 * Compensatory tracking plant.
 *
 * Each channel has a `mode` per leg:
 *   'maintain'   — target fixed; disturbance active; user holds
 *   'consistent' — target drifts smoothly (slow OU walk around base)
 *   'irregular'  — target jumps to a new random offset every few seconds
 *   'inactive'   — disturbance frozen; value held at base; not scored
 */

export function createFlightState(cfg) {
  return {
    altitude: cfg.altitude.initial,
    vSpeed: 0,
    heading: cfg.heading.initial,
    headingRate: 0,
    speed: cfg.speed.initial,
    throttle: cfg.speed.initialThrottle,

    distVSpeed: 0,
    distHdgRate: 0,
    distSpeed: 0,

    currentTargetAltitude: cfg.altitude.target,
    currentTargetHeading:  cfg.heading.target,
    currentTargetSpeed:    cfg.speed.target,

    drftAlt: 0, drftHdg: 0, drftSpd: 0,
    nextJumpAlt: 0, nextJumpHdg: 0, nextJumpSpd: 0,
  };
}

export function stepFlight(state, inputs, mode, cfg, dt, rng) {
  state.currentTargetAltitude = updateTarget('altitude', mode.altitude, state.currentTargetAltitude, cfg.altitude, state, dt, rng);
  state.currentTargetHeading  = updateTarget('heading',  mode.heading,  state.currentTargetHeading,  cfg.heading,  state, dt, rng);
  state.currentTargetSpeed    = updateTarget('speed',    mode.speed,    state.currentTargetSpeed,    cfg.speed,    state, dt, rng);

  const altInactive = mode.altitude === 'inactive';
  const hdgInactive = mode.heading  === 'inactive';
  const spdInactive = mode.speed    === 'inactive';

  state.distVSpeed  = altInactive ? 0 : ouStep(state.distVSpeed,  cfg.altitude.disturbanceSigma, cfg.altitude.disturbanceTau, dt, rng);
  state.distHdgRate = hdgInactive ? 0 : ouStep(state.distHdgRate, cfg.heading.disturbanceSigma,  cfg.heading.disturbanceTau,  dt, rng);
  state.distSpeed   = spdInactive ? 0 : ouStep(state.distSpeed,   cfg.speed.disturbanceSigma,    cfg.speed.disturbanceTau,    dt, rng);

  if (altInactive) {
    state.vSpeed = 0;
    state.altitude = state.currentTargetAltitude;
  } else {
    const vSpeedCmd = cfg.altitude.gainPitch * clampPM1(inputs.pitch) + state.distVSpeed;
    state.vSpeed += (vSpeedCmd - state.vSpeed) * (dt / cfg.altitude.rateLag);
    state.altitude += state.vSpeed * dt;
  }

  if (hdgInactive) {
    state.headingRate = 0;
    state.heading = state.currentTargetHeading;
  } else {
    const hdgRateCmd = cfg.heading.gainRoll * clampPM1(inputs.roll) + state.distHdgRate;
    state.headingRate += (hdgRateCmd - state.headingRate) * (dt / cfg.heading.rateLag);
    state.heading = wrap360(state.heading + state.headingRate * dt);
  }

  state.throttle = clamp01(inputs.throttle);
  if (spdInactive) {
    state.speed = state.currentTargetSpeed;
  } else {
    const baseEq = cfg.speed.minThrottleSpeed + (cfg.speed.maxThrottleSpeed - cfg.speed.minThrottleSpeed) * state.throttle;
    // Pitch-induced drag: any pitch deflection (up OR down) bleeds speed,
    // forcing the trainee to manage throttle alongside pitch. This is the
    // characteristic "feel" of Mozard / SkyTest compensatory tracking, and
    // the reason the task is genuinely three-channel rather than two.
    // Skipped when the altitude channel is inactive (no pitch input
    // expected on those legs).
    const pitchDrag = altInactive
      ? 0
      : (cfg.speed.pitchDragGain ?? 0) * Math.abs(clampPM1(inputs.pitch));
    const eq = baseEq - pitchDrag;
    const speedCmd = eq + state.distSpeed;
    state.speed += (speedCmd - state.speed) * (dt / cfg.speed.rateLag);
  }
}

function updateTarget(channelName, modeStr, currentTarget, ccfg, state, dt, rng) {
  const baseTarget = ccfg.target;
  switch (modeStr) {
    case 'maintain':
    case 'inactive':
      if (channelName === 'altitude') { state.drftAlt = 0; state.nextJumpAlt = 0; }
      if (channelName === 'heading')  { state.drftHdg = 0; state.nextJumpHdg = 0; }
      if (channelName === 'speed')    { state.drftSpd = 0; state.nextJumpSpd = 0; }
      return baseTarget;

    case 'consistent': {
      const k = channelName === 'altitude' ? 'drftAlt' : channelName === 'heading' ? 'drftHdg' : 'drftSpd';
      state[k] = ouStep(state[k], ccfg.consistentDriftSigma, ccfg.consistentDriftTau, dt, rng);
      let next = baseTarget + state[k];
      if (channelName === 'heading') next = wrap360(next);
      return next;
    }

    case 'irregular': {
      const k = channelName === 'altitude' ? 'nextJumpAlt' : channelName === 'heading' ? 'nextJumpHdg' : 'nextJumpSpd';
      state[k] -= dt;
      if (state[k] <= 0) {
        const offset = (rng() * 2 - 1) * ccfg.irregularJumpRange;
        let next = baseTarget + offset;
        if (channelName === 'heading') next = wrap360(next);
        state[k] = ccfg.irregularMinInterval + rng() * (ccfg.irregularMaxInterval - ccfg.irregularMinInterval);
        return next;
      }
      return currentTarget;
    }

    default: return baseTarget;
  }
}

function ouStep(x, sigma, tau, dt, rng) {
  if (sigma <= 0) return 0;
  const decay = Math.exp(-dt / tau);
  return x * decay + sigma * Math.sqrt(1 - decay * decay) * gaussian(rng);
}
function gaussian(rng) {
  const u = Math.max(rng(), 1e-9);
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function wrap360(a) { let x = a % 360; if (x < 0) x += 360; return x; }
function clamp01(x) { return Math.max(0, Math.min(1, x)); }
function clampPM1(x) { return Math.max(-1, Math.min(1, x)); }

export function angularDiff(a, b) {
  return ((a - b) % 360 + 540) % 360 - 180;
}