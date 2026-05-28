/**
 * Compensatory tracking plant.
 *
 * Each channel has a `mode` per leg:
 *   'maintain'   — target fixed; disturbance active; user holds
 *   'consistent' — target drifts smoothly (slow OU walk around base)
 *   'irregular'  — target jumps to a new random offset every few seconds
 *   'inactive'   — disturbance frozen; value held at base; not scored
 *
 * Heading-band-shake fix (consistent mode):
 *   The OU process produces correlated drift but with HIGH-FREQUENCY noise
 *   per step (≈ 0.3° / frame std on heading at 60 fps, which is ~3 px on
 *   the heading tape). The user perceives that as "shaking". We feed the
 *   OU output through a first-order low-pass filter with τ ≈ 1.5 s
 *   (`consistentDriftSmoothTau`) before adding it to the target. The
 *   visible band motion becomes ~0.2 px / frame — smooth — without
 *   changing the long-term drift envelope.
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

    // Raw OU output per channel (the "wandering goal" the band chases).
    drftAlt: 0, drftHdg: 0, drftSpd: 0,
    // First-order low-pass output of the OU above — this is what actually
    // gets added to the base target, so the band moves smoothly.
    drftAltSmoothed: 0, drftHdgSmoothed: 0, drftSpdSmoothed: 0,
    // Countdown timers for irregular-jump mode.
    nextJumpAlt: 0, nextJumpHdg: 0, nextJumpSpd: 0,
     irrSetAlt: 0, irrSetHdg: 0, irrSetSpd: 0,
    // First-order low-pass of the setpoint above. With irregularSmoothTau
    // === 0 (every level except expert altitude/heading) this just copies
    // the setpoint and the visible behaviour is identical to a snap.
    irrSmAlt:  0, irrSmHdg:  0, irrSmSpd:  0,
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
    //const vSpeedCmd = cfg.altitude.gainPitch * clampPM1(inputs.pitch) + state.distVSpeed;
    const vSpeedCmd = cfg.altitude.gainPitch * clampPM1(inputs.pitch) + state.distVSpeed + (cfg.altitude.disturbanceBias ?? 0);

    state.vSpeed += (vSpeedCmd - state.vSpeed) * (dt / cfg.altitude.rateLag);
    state.altitude += state.vSpeed * dt;
  }

  if (hdgInactive) {
    state.headingRate = 0;
    state.heading = state.currentTargetHeading;
  } else {
    //const hdgRateCmd = cfg.heading.gainRoll * clampPM1(inputs.roll) + state.distHdgRate;
    const hdgRateCmd = cfg.heading.gainRoll * clampPM1(inputs.roll) + state.distHdgRate + (cfg.heading.disturbanceBias ?? 0);

    state.headingRate += (hdgRateCmd - state.headingRate) * (dt / cfg.heading.rateLag);
    state.heading = wrap360(state.heading + state.headingRate * dt);
  }

  state.throttle = clamp01(inputs.throttle);
  if (spdInactive) {
    state.speed = state.currentTargetSpeed;
  } else {
  // 1. Throttle sets the equilibrium airspeed.
  //    throttle=0  → minThrottleSpeed (e.g. 100 kt)
  //    throttle=1  → maxThrottleSpeed (e.g. 200 kt)
  //    throttle=0.5→ midpoint (150 kt)
  const baseEq = cfg.speed.minThrottleSpeed
               + (cfg.speed.maxThrottleSpeed - cfg.speed.minThrottleSpeed) * state.throttle;

  // 2. Energy trade with altitude (signed, realistic aviation physics):
  //    climbing  (vSpeed > 0) → kinetic energy → potential energy → speed drops
  //    descending(vSpeed < 0) → potential energy → kinetic energy → speed rises
  //    Gain = kt of equilibrium-speed shift per ft/sec of vertical rate.
  //    With vSpeed up to ±10 ft/sec at moderate pitch and gain ≈ 0.8,
  //    a steady climb costs ≈ 8 kt — enough to require throttle correction.
  const altRateGain = cfg.speed.altRateCouplingGain ?? 0.8;
  const altCoupling = altInactive ? 0 : altRateGain * state.vSpeed;

  const eq = baseEq - altCoupling;

  // 3. Disturbance + first-order lag toward equilibrium.
  //const speedCmd = eq + state.distSpeed;
  const speedCmd = eq + state.distSpeed + (cfg.speed.disturbanceBias ?? 0);

  state.speed += (speedCmd - state.speed) * (dt / cfg.speed.rateLag);
}
}

function updateTarget(channelName, modeStr, currentTarget, ccfg, state, dt, rng) {
  const baseTarget = ccfg.target;
  const driftKey  = channelName === 'altitude' ? 'drftAlt'         : channelName === 'heading' ? 'drftHdg'         : 'drftSpd';
  const smoothKey = channelName === 'altitude' ? 'drftAltSmoothed' : channelName === 'heading' ? 'drftHdgSmoothed' : 'drftSpdSmoothed';
  const jumpKey   = channelName === 'altitude' ? 'nextJumpAlt'     : channelName === 'heading' ? 'nextJumpHdg'     : 'nextJumpSpd';
  const irrSetKey = channelName === 'altitude' ? 'irrSetAlt'       : channelName === 'heading' ? 'irrSetHdg'       : 'irrSetSpd';
  const irrSmKey  = channelName === 'altitude' ? 'irrSmAlt'        : channelName === 'heading' ? 'irrSmHdg'        : 'irrSmSpd';

  switch (modeStr) {
    case 'maintain':
    case 'inactive':
      // Channel parked at base — wipe every drift / jump / slew slot so
      // the next active leg of any mode starts from a clean slate.
      state[driftKey]  = 0;
      state[smoothKey] = 0;
      state[irrSetKey] = 0;
      state[irrSmKey]  = 0;
      state[jumpKey]   = 0;
      return baseTarget;

    case 'consistent': {
      // OU drift active; irregular slots held at 0 so a later irregular
      // leg starts from base instead of inheriting a stale setpoint.
      state[irrSetKey] = 0;
      state[irrSmKey]  = 0;
      state[jumpKey]   = 0;

      // 1. Raw OU drift (correlated random walk around 0 with std=sigma).
      state[driftKey] = ouStep(state[driftKey], ccfg.consistentDriftSigma, ccfg.consistentDriftTau, dt, rng);
      // 2. Low-pass to strip the high-frequency per-step jitter.
      const smoothTau = ccfg.consistentDriftSmoothTau ?? 1.5;
      state[smoothKey] += (state[driftKey] - state[smoothKey]) * (dt / smoothTau);
      let next = baseTarget + state[smoothKey];
      if (channelName === 'heading') next = wrap360(next);
      return next;
    }

    case 'irregular': {
      // Irregular active; OU slots held at 0 so a later consistent leg
      // starts clean. (This preserves the old behaviour exactly.)
      state[driftKey]  = 0;
      state[smoothKey] = 0;

      // Tick the jump timer. On expiry sample a fresh offset into the
      // SETPOINT slot. The smoothed slew below either copies it (snap)
      // or eases toward it (expert altitude/heading).
      state[jumpKey] -= dt;
      if (state[jumpKey] <= 0) {
        state[irrSetKey] = (rng() * 2 - 1) * ccfg.irregularJumpRange;
        state[jumpKey] = ccfg.irregularMinInterval
          + rng() * (ccfg.irregularMaxInterval - ccfg.irregularMinInterval);
      }
      // First-order LP slew of the setpoint.
      //   τ === 0 → direct copy → bit-identical to the old snap.
      //   τ  > 0 → exponential approach → smooth slew.
      // For heading the LP runs on the *offset* (always bounded to
      // ±irregularJumpRange = ±12° at expert) so plain linear filtering
      // is correct; the wrap is applied at the end after adding to base.
      const smoothTau = ccfg.irregularSmoothTau ?? 0;
      if (smoothTau > 0) {
        state[irrSmKey] += (state[irrSetKey] - state[irrSmKey]) * (dt / smoothTau);
      } else {
        state[irrSmKey] = state[irrSetKey];
      }
      let next = baseTarget + state[irrSmKey];
      if (channelName === 'heading') next = wrap360(next);
      return next;
    }

    default:
      return baseTarget;
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