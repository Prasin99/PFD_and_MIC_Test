import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
//import { buildFlightConfig } from '../flightCore/flightConfig.js';
import { buildFlightConfig, BRIEFING_DURATION_MS } from '../flightCore/flightConfig.js';
import { createFlightState, stepFlight, angularDiff } from '../flightCore/flightDynamics.js';
import { useInputAxes } from '../flightCore/useInputAxes.js';
import { useFlightLoop } from '../flightCore/useFlightLoop.js';
import { createToleranceTracker } from '../flightCore/toleranceTracker.js';
import { legAt, totalLegsDuration } from '../flightCore/legSequence.js';
import { AltitudeTape } from '../flightCore/instruments/AltitudeTape.jsx';
import { HeadingTape } from '../flightCore/instruments/HeadingTape.jsx';
import { SpeedTape } from '../flightCore/instruments/SpeedTape.jsx';
import { ThrottleSlider } from '../flightCore/instruments/ThrottleSlider.jsx';
import { SessionHeader } from '../flightCore/instruments/SessionHeader.jsx';
import { AircraftSymbol } from '../flightCore/instruments/AircraftSymbol.jsx';
import { ToleranceMessage } from '../flightCore/instruments/ToleranceMessage.jsx';
import { BriefingModal } from '../flightCore/instruments/BriefingModal.jsx';
//import { defaultLegs } from './legs.js';
import { buildDifficultyLegs } from './legs.js';

export function PFDTrackingTraining({ settings = {}, onComplete = () => {}, onExit = () => {} }) {
  const {
  duration = 240,
  difficulty = 'medium',
  enableAltitude = true,
  enableHeading = true,
  enableSpeed = true,
  locale = 'en',
  legs = null,
} = settings;

  const cfg = useMemo(() => buildFlightConfig(difficulty), [difficulty]);
  const activeLegs = useMemo(() => {
  if (Array.isArray(legs) && legs.length > 0) return legs;
  const difficultyLegs = buildDifficultyLegs(duration);
  return difficultyLegs[difficulty] ?? difficultyLegs.medium;
}, [legs, difficulty, duration]);

  const stateRef = useRef(null);
  const elapsedRef = useRef(0);
  const currentLegIdxRef = useRef(0);
  const runningRef = useRef(false);
  const tickAccumRef = useRef(0);
  const trackerRef = useRef(null);

  const [display, setDisplay] = useState({
    altitude: cfg.altitude.initial, heading: cfg.heading.initial, speed: cfg.speed.initial,
    throttle: cfg.speed.initialThrottle,
    targetAltitude: cfg.altitude.target, targetHeading: cfg.heading.target, targetSpeed: cfg.speed.target,
    elapsedSec: 0,
  });
  const [paused, setPaused] = useState(false);
  const [phase, setPhase] = useState('briefing');
  const [activeLegIdx, setActiveLegIdx] = useState(0);
  const [outOfTol, setOutOfTol] = useState({ alt: false, hdg: false, spd: false });

  const [briefingRemainingSec, setBriefingRemainingSec] = useState(
    Math.ceil(BRIEFING_DURATION_MS / 1000)
  );
  // Per-channel tolerance level for the BLUE pin color on each tape:
  //   'green'  → pin renders blue  (within green tolerance band — on target)
  //   'yellow' → pin renders yellow (within yellow band — drifting)
  //   'red'    → pin renders red   (outside yellow band — out of tolerance)
  const [pinLevel, setPinLevel] = useState({ alt: 'green', hdg: 'green', spd: 'green' });

  useEffect(() => {
    stateRef.current = createFlightState(cfg);
    trackerRef.current = createToleranceTracker({
      altitude: { tolerance: cfg.altitude.tolerance },
      heading:  { tolerance: cfg.heading.tolerance, circular: true },
      speed:    { tolerance: cfg.speed.tolerance },
    });
    elapsedRef.current = 0;
    currentLegIdxRef.current = 0;
  }, [cfg]);

  const { poll, setThrottle } = useInputAxes(cfg.speed.initialThrottle);

  const effectiveMode = useCallback((legMode) => ({
    altitude: enableAltitude ? legMode.altitude : 'inactive',
    heading:  enableHeading  ? legMode.heading  : 'inactive',
    speed:    enableSpeed    ? legMode.speed    : 'inactive',
  }), [enableAltitude, enableHeading, enableSpeed]);

  useFlightLoop((dt) => {
    if (!stateRef.current || !trackerRef.current) return;

    // ── 1. Time's up? End the session before anything else. ──────────
    // Done first so the wrap-around frame (elapsed >= totalLeg) ends the
    // session cleanly instead of triggering another "Next leg" briefing.
    if (elapsedRef.current >= duration) {
      runningRef.current = false;
      setPhase('done');
      return;
    }

    // ── 2. Which leg are we in? ──────────────────────────────────────
    // Clamp `safeElapsed` just under the total so `legAt` always returns
    // the last leg on the final frame instead of wrapping around to 0.
    const totalLeg = totalLegsDuration(activeLegs) || 1;
    const safeElapsed = Math.min(elapsedRef.current, totalLeg - 1e-6);
    const { index: legIdx, leg } = legAt(activeLegs, safeElapsed);

    // ── 3. Moved into a new leg? Pause and show the briefing for it. ─
    // Done BEFORE stepFlight so the new leg's mode doesn't run for one
    // physics frame before the trainee sees the briefing.
    if (legIdx !== currentLegIdxRef.current) {
      currentLegIdxRef.current = legIdx;
      runningRef.current = false;
      setActiveLegIdx(legIdx);
      setPhase('briefing');
      return;
    }

    // ── 4. Step physics for the current leg. ─────────────────────────
    const mode   = effectiveMode(leg.mode);
    const inputs = poll(dt);
    stepFlight(stateRef.current, inputs, mode, cfg, dt, Math.random);
    elapsedRef.current += dt;

    const s = stateRef.current;
    if (mode.altitude !== 'inactive') trackerRef.current.record('altitude', s.altitude, s.currentTargetAltitude, dt);
    if (mode.heading  !== 'inactive') trackerRef.current.record('heading',  s.heading,  s.currentTargetHeading,  dt);
    if (mode.speed    !== 'inactive') trackerRef.current.record('speed',    s.speed,    s.currentTargetSpeed,    dt);

    tickAccumRef.current += dt;
    if (tickAccumRef.current >= 1 / 30) {
      tickAccumRef.current = 0;
      setDisplay({
        altitude: s.altitude, heading: s.heading, speed: s.speed,
        throttle: s.throttle,
        targetAltitude: s.currentTargetAltitude,
        targetHeading: s.currentTargetHeading,
        targetSpeed: s.currentTargetSpeed,
        elapsedSec: elapsedRef.current,
      });

      const errAlt = mode.altitude !== 'inactive' ? Math.abs(s.altitude - s.currentTargetAltitude) : 0;
      const errHdg = mode.heading  !== 'inactive' ? Math.abs(angularDiff(s.heading, s.currentTargetHeading)) : 0;
      const errSpd = mode.speed    !== 'inactive' ? Math.abs(s.speed - s.currentTargetSpeed) : 0;
      setOutOfTol({
        alt: errAlt > cfg.altitude.tolerance.green,
        hdg: errHdg > cfg.heading.tolerance.green,
        spd: errSpd > cfg.speed.tolerance.green,
      });
      setPinLevel({
        alt: levelFor(errAlt, cfg.altitude.tolerance),
        hdg: levelFor(errHdg, cfg.heading.tolerance),
        spd: levelFor(errSpd, cfg.speed.tolerance),
      });
    }
  }, runningRef);

  useEffect(() => {
    if (phase !== 'done' || !trackerRef.current) return;
    const summary = trackerRef.current.summary();
    onComplete({
      duration: elapsedRef.current,
      completedAt: Date.now(),
      results: { ...summary, overall: computeOverall(summary) },
    });
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePauseToggle = useCallback(() => {
    if (phase !== 'flying') return;
    setPaused((p) => { const next = !p; runningRef.current = !next; return next; });
  }, [phase]);

  const handleBriefingDismiss = useCallback(() => {
    if (phase !== 'briefing') return;
    setPhase('flying');
    if (!paused) runningRef.current = true;
  }, [phase, paused]);

  // Auto-advance the briefing after BRIEFING_DURATION_MS. The 1-Hz
  // interval drives the on-screen countdown; the setTimeout fires the
  // actual dismissal. SPACE still skips early via BriefingModal →
  // onDismiss → handleBriefingDismiss, which flips `phase` to 'flying'
  // and triggers the cleanup below.
  useEffect(() => {
    if (phase !== 'briefing') return;
    setBriefingRemainingSec(Math.ceil(BRIEFING_DURATION_MS / 1000));

    const tick = setInterval(() => {
      setBriefingRemainingSec((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    const dismiss = setTimeout(() => {
      handleBriefingDismiss();
    }, BRIEFING_DURATION_MS);

    return () => {
      clearInterval(tick);
      clearTimeout(dismiss);
    };
  }, [phase, handleBriefingDismiss]);

  const currentLeg = activeLegs[activeLegIdx] ?? activeLegs[0];
  const mode = effectiveMode(currentLeg.mode);
  const isFlying = phase === 'flying';
  const altActive = mode.altitude !== 'inactive';
  const hdgActive = mode.heading  !== 'inactive';
  const spdActive = mode.speed    !== 'inactive';

  const t = (k) => MESSAGES[locale]?.[k] ?? MESSAGES.en[k];
  const messages = [];
  if (isFlying) {
    if (altActive && outOfTol.alt) messages.push(t('altOff'));
    if (hdgActive && outOfTol.hdg) messages.push(t('hdgOff'));
    if (spdActive && outOfTol.spd) messages.push(t('spdOff'));
  }

  const headerLabels = locale === 'de'
    ? { pause: 'Pause', resume: 'Weiter', exit: 'Beenden', time: 'Zeit' }
    : { pause: 'Pause', resume: 'Resume', exit: 'Exit', time: 'Time' };

  const remaining = Math.max(0, Math.ceil(duration - display.elapsedSec));

  return (
    <div className="w-full h-full flex flex-col bg-gray-50 relative">
      <SessionHeader
        remainingSec={remaining}
        elapsedSec={display.elapsedSec}
        paused={paused}
        onPauseToggle={handlePauseToggle}
        onExit={onExit}
        labels={headerLabels}
      />

      <div className="flex-1 flex items-center justify-center px-6 py-4 relative">
        <div className="flex items-start gap-8">
          <AltitudeTape
            value={display.altitude}
            target={display.targetAltitude}
            tolerance={cfg.altitude.tolerance}
            tapeSpan={cfg.altitude.tapeSpan}
            majorStep={cfg.altitude.majorStep}
            minorStep={cfg.altitude.minorStep}
            inactive={!altActive}
            outOfTolerance={isFlying && altActive && outOfTol.alt}
            pinLevel={altActive ? pinLevel.alt : 'green'}
            label={t('altitude')}
            followCurrent={true}
          />

          <div className="flex flex-col items-center" style={{ width: 720 }}>
            <div className="flex items-center justify-center" style={{ height: 280 }}>
              <AircraftSymbol size={70} />
            </div>
            <HeadingTape
              value={display.heading}
              target={display.targetHeading}
              tolerance={cfg.heading.tolerance}
              tapeSpan={cfg.heading.tapeSpan}
              majorStep={cfg.heading.majorStep}
              minorStep={cfg.heading.minorStep}
              inactive={!hdgActive}
              outOfTolerance={isFlying && hdgActive && outOfTol.hdg}
              pinLevel={hdgActive ? pinLevel.hdg : 'green'}
              label={t('heading')}
              followCurrent={true}

            />
            <div className="mt-4 h-[80px]">
  <ToleranceMessage messages={messages} />
</div>
          </div>

          <div className="flex items-start gap-3">
            <SpeedTape
              value={display.speed}
              target={display.targetSpeed}
              tolerance={cfg.speed.tolerance}
              tapeSpan={cfg.speed.tapeSpan}
              majorStep={cfg.speed.majorStep}
              minorStep={cfg.speed.minorStep}
              inactive={!spdActive}
              outOfTolerance={isFlying && spdActive && outOfTol.spd}
              pinLevel={spdActive ? pinLevel.spd : 'green'}
              label={t('speed')}
              followCurrent={true}

            />
            <div style={{ marginTop: 24 }}>
              <ThrottleSlider
                value={display.throttle}
                onSet={setThrottle}
                inactive={!spdActive}
                height={400}
              />
            </div>
          </div>
        </div>
      </div>

      {phase === 'briefing' && currentLeg && (
        <BriefingModal
          title={locale === 'de' ? 'Nächster Abschnitt' : 'Next leg'}
          lines={currentLeg.briefing[locale] ?? currentLeg.briefing.en}
          hint={
            locale === 'de'
              ? `Beginnt in ${briefingRemainingSec}s · Leertaste zum Überspringen`
              : `Starting in ${briefingRemainingSec}s · SPACE to skip`
          }
          onDismiss={handleBriefingDismiss}
        />
      )}

      {phase === 'flying' && paused && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-40 pointer-events-none">
          <div className="bg-white px-8 py-4 rounded shadow text-lg font-semibold text-gray-700">
            {locale === 'de' ? 'Pausiert' : 'Paused'}
          </div>
        </div>
      )}

      <div className="px-6 py-2 text-xs text-gray-500 border-t border-gray-200 bg-white">
        {locale === 'de'
          ? '↑ ↓ Höhe   ←→ Kurs   Q / A  Schub   (Joystick wird automatisch erkannt)'
          : '↑ ↓ pitch (altitude)   ← → roll (heading)   Q / A  throttle   (joystick auto-detected)'}
      </div>
    </div>
  );
}

const MESSAGES = {
  en: {
    altitude: 'ALTITUDE', heading: 'HEADING', speed: 'SPEED',
    altOff: 'Altitude out of tolerance',
    hdgOff: 'Heading out of tolerance',
    spdOff: 'Speed out of tolerance',
  },
  de: {
    altitude: 'HÖHE', heading: 'KURS', speed: 'GESCHW.',
    altOff: 'Höhe außerhalb der Toleranz',
    hdgOff: 'Kurs außerhalb der Toleranz',
    spdOff: 'Geschwindigkeit außerhalb der Toleranz',
  },
};

function computeOverall(summary) {
  const channels = ['altitude', 'heading', 'speed'];
  const active = channels.filter((c) => summary[c] && summary[c].totalTime > 0.5);
  if (active.length === 0) return 0;
  return active.reduce((acc, c) => acc + summary[c].fractionGreen, 0) / active.length;
}

/**
 * Map an absolute error against a {green, yellow} tolerance band to a
 * three-state level used to color the blue current-value pin on each tape.
 *   err ≤ green  → 'green'  (pin stays blue — on target)
 *   err ≤ yellow → 'yellow' (pin turns yellow — drifting)
 *   else         → 'red'    (pin turns red — out of tolerance)
 */
function levelFor(err, tol) {
  if (err <= tol.green)  return 'green';
  if (err <= tol.yellow) return 'yellow';
  return 'red';
}