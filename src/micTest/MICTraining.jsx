import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useFlightLoop }  from '../flightCore/useFlightLoop';
import { useInputAxes }   from '../flightCore/useInputAxes';
import { createFlightState, stepFlight, angularDiff } from '../flightCore/flightDynamics';
import { CompassDial }    from '../flightCore/instruments/CompassDial';
import { AltimeterDial }  from '../flightCore/instruments/AltimeterDial';
import { AirspeedDial }   from '../flightCore/instruments/AirspeedDial';
import { ClockDial }      from '../flightCore/instruments/ClockDial';
import { ThrottleSlider } from '../flightCore/instruments/ThrottleSlider';
import { ListeningButtons } from '../flightCore/instruments/ListeningButtons';
import { SessionHeader }  from '../flightCore/instruments/SessionHeader';
import { BriefingModal }  from '../flightCore/instruments/BriefingModal';
import { useTripletDetection } from './listening/useTripletDetection';
import { MIC_CONFIG, buildMICChannelConfig } from './micConfig';

const COUNTDOWN_STEP_MS = 1000;        // each number (3, 2, 1) visible for 1 sec
const GAP_BEFORE_BRIEFING_MS = 100;
const BRIEFING_MS = 5000;
const FEEDBACK_MS = 1500; 
// const MISS_FEEDBACK_MS = 3000;    // how long "Listening task: response missed" stays

// Phases: leg-indicator → gap → briefing → running ( ↔ paused )
// Phases: countdown (3→2→1) → gap → briefing → running ( ↔ paused )

export function MICTraining({ settings, onComplete, onExit }) {
  const { level, activeInstruments, listeningTask, duration } = settings;
  const { targetMode } = level;

  const { axesRef, poll, setThrottle } = useInputAxes(MIC_CONFIG.initial.throttle);

  const channelMode = {
    altitude: activeInstruments.includes('altitude') ? targetMode : 'inactive',
    heading:  activeInstruments.includes('heading')  ? targetMode : 'inactive',
    speed:    activeInstruments.includes('airspeed') ? targetMode : 'inactive',
  };

  const channelCfgRef = useRef(buildMICChannelConfig());
  const stateRef = useRef(null);
  if (stateRef.current === null) {
    stateRef.current = createFlightState(channelCfgRef.current);
  }

  // ── Phase machine for the start sequence + pause ──
 const [phase, setPhase] = useState('countdown');
const [countdown, setCountdown] = useState(3);
useEffect(() => {
  const t2   = setTimeout(() => setCountdown(2),          COUNTDOWN_STEP_MS);
  const t1   = setTimeout(() => setCountdown(1),      2 * COUNTDOWN_STEP_MS);
  const tGap = setTimeout(() => setPhase('gap'),      3 * COUNTDOWN_STEP_MS);
  const tBr  = setTimeout(() => setPhase('briefing'), 3 * COUNTDOWN_STEP_MS + GAP_BEFORE_BRIEFING_MS);
  const tRun = setTimeout(() => setPhase('running'),  3 * COUNTDOWN_STEP_MS + GAP_BEFORE_BRIEFING_MS + BRIEFING_MS);
  return () => {
    clearTimeout(t2); clearTimeout(t1); clearTimeout(tGap);
    clearTimeout(tBr); clearTimeout(tRun);
  };
}, []);

  const runningRef = useRef(false);
  useEffect(() => { runningRef.current = (phase === 'running'); }, [phase]);

  const togglePause = () => {
    setPhase((p) => (p === 'running' ? 'paused' : p === 'paused' ? 'running' : p));
  };

  // ── Render snapshot ──
  const initSnap = () => {
    const s = stateRef.current;
    return {
      heading: s.heading, altitude: s.altitude, airspeed: s.speed, throttle: s.throttle,
      tHeading: s.currentTargetHeading,
      tAltitude: s.currentTargetAltitude,
      tAirspeed: s.currentTargetSpeed,
    };
  };
  const [snap, setSnap] = useState(initSnap);
  const [elapsed, setElapsed] = useState(0);

  const elapsedRef  = useRef(0);
  const samplesRef  = useRef([]);
  const finishedRef = useRef(false);

  const listening = useTripletDetection({
    enabled: listeningTask && phase === 'running',
    config:  MIC_CONFIG.listening,
  });

  // ── Main RAF tick (only ticks when runningRef.current is true) ──
  useFlightLoop((dt) => {
    if (finishedRef.current) return;

    const inputs = poll(dt);
    // TEMP DEBUG — paste exactly, remove later
const pads = navigator.getGamepads?.() ?? [];
const pad = Array.from(pads).find((p) => p && p.connected);
if (pad && (Math.abs(inputs.pitch) > 0.1 || Math.abs(inputs.roll) > 0.1)) {
  console.log(
    'IN  pitch:', inputs.pitch.toFixed(2),
    '| roll:', inputs.roll.toFixed(2),
    '| raw axes:', pad.axes.map((v) => v.toFixed(2)).join(', ')
  );
}
//
    stepFlight(stateRef.current, inputs, channelMode, channelCfgRef.current, dt, Math.random);

    const s = stateRef.current;
    samplesRef.current.push({
      t: elapsedRef.current,
      headingDev:  Math.abs(angularDiff(s.heading, s.currentTargetHeading)),
      altitudeDev: Math.abs(s.altitude - s.currentTargetAltitude),
      airspeedDev: Math.abs(s.speed    - s.currentTargetSpeed),
    });

    setSnap({
      heading: s.heading, altitude: s.altitude, airspeed: s.speed, throttle: s.throttle,
      tHeading: s.currentTargetHeading,
      tAltitude: s.currentTargetAltitude,
      tAirspeed: s.currentTargetSpeed,
    });
    setElapsed(elapsedRef.current);

    elapsedRef.current += dt;
    if (elapsedRef.current >= duration) {
      finishedRef.current = true;
      runningRef.current  = false;
      onComplete({
        level, activeInstruments, listeningTask, duration,
        samples: samplesRef.current,
        listeningResults: listening?.results ?? null,
      });
    }
  }, runningRef);

  // ── Tolerance + bottom message ──
  const tol = MIC_CONFIG.tolerance;
  const isActive = (k) => activeInstruments.includes(k);
  const oot = {
    heading:  isActive('heading')  && Math.abs(angularDiff(snap.heading, snap.tHeading)) > tol.heading.yellow,
    altitude: isActive('altitude') && Math.abs(snap.altitude - snap.tAltitude)           > tol.altitude.yellow,
    airspeed: isActive('airspeed') && Math.abs(snap.airspeed - snap.tAirspeed)           > tol.airspeed.yellow,
  };

  // const recentMiss = listening?.lastMissedAt
  //   && (performance.now() - listening.lastMissedAt) < MISS_FEEDBACK_MS;

const recentCorrect = listening?.lastCorrectAt
  && (performance.now() - listening.lastCorrectAt) < FEEDBACK_MS;
const recentWrong   = listening?.lastWrongAt
  && (performance.now() - listening.lastWrongAt)   < FEEDBACK_MS;

  // const bottomMessage = useMemo(() => {
  //   if (recentMiss) return 'Listening task: response missed';
  //   const names = [];
  //   if (oot.altitude) names.push('Altimeter');
  //   if (oot.heading)  names.push('Compass');
  //   if (oot.airspeed) names.push('Airspeed');
  //   if (names.length === 0) return null;
  //   if (names.length === 1) return `${names[0]} outside its tolerance`;
  //   const head = names.slice(0, -1).join(', ');
  //   return `${head} and ${names[names.length - 1]} outside their tolerances`;
  // }, [recentMiss, oot.altitude, oot.heading, oot.airspeed]);

const bottomMessage = useMemo(() => {
  if (recentCorrect) return { text: 'Listening task: correct response',  color: 'green' };
  if (recentWrong)   return { text: 'Listening task: wrongful response', color: 'red'   };

   const names = [];
  if (oot.altitude) names.push('Altimeter');
  if (oot.heading)  names.push('Compass');
  if (oot.airspeed) names.push('Airspeed');
  if (names.length === 0) return null;
  if (names.length === 1) return { text: `${names[0]} outside its tolerance`, color: 'red' };
  const head = names.slice(0, -1).join(', ');
  return { text: `${head} and ${names[names.length - 1]} outside their tolerances`, color: 'red' };
}, [recentCorrect, recentWrong, oot.altitude, oot.heading, oot.airspeed]);

  // Briefing lines mirror what's shown in your recording
  const briefingLines = [
    `Compass: ${channelMode.heading === 'inactive' ? 'inactive' : channelMode.heading + ' indications'}`,
    `Altimeter: ${channelMode.altitude === 'inactive' ? 'inactive' : channelMode.altitude + ' indications'}`,
    `Airspeed indicator: ${channelMode.speed === 'inactive' ? 'inactive' : channelMode.speed + ' indications'}`,
    `Listening task: ${listeningTask ? 'active' : 'inactive'}`,
  ];

  return (
  <div className="relative w-screen h-screen bg-[#1a1a1a] overflow-hidden flex flex-col">


    {/* ── Top bar — same style as PFD ── */}
  <SessionHeader
  remainingSec={Math.max(0, duration - elapsed)}
  paused={phase === 'paused'}
  onPauseToggle={togglePause}
  onExit={onExit}
/>

     {/* ── Main area: 3×3 grid (compass top, side dials mid, clock bottom) ── */}
<div className="flex-1 relative text-white">
  <div className="grid grid-cols-3 grid-rows-[auto_auto_auto]
                  gap-x-12 gap-y-4 place-items-center px-16 pt-8 pb-16">

    {/* Row 1: empty | Compass | empty */}
    <div />
    <CompassDial
      value={snap.heading} target={snap.tHeading} tolerance
      size={260}
      inactive={!isActive('heading')}
      outOfTolerance={oot.heading}
    />
    <div />

    {/* Row 2: Throttle+Airspeed | empty | Altimeter */}
    <div className="flex items-center gap-3">
      <ThrottleSlider value={snap.throttle} onChange={setThrottle} />
      <AirspeedDial
        value={snap.airspeed} target={snap.tAirspeed} tolerance
        size={260}
        inactive={!isActive('airspeed')}
        outOfTolerance={oot.airspeed}
      />
    </div>
    <div />
    <AltimeterDial
      value={snap.altitude} target={snap.tAltitude} tolerance
      size={260}
      inactive={!isActive('altitude')}
      outOfTolerance={oot.altitude}
    />

    {/* Row 3: Buttons | Clock | empty */}
    {listeningTask
      ? <ListeningButtons size={70} onRed={listening.pressRed} onGreen={listening.pressGreen} />
      : <div />}
    <ClockDial value={elapsed} size={200} />
    <div />
  </div>

  {/* Bottom red message */}
{bottomMessage && phase === 'running' && (
  <div className={`absolute bottom-8 left-0 right-0 text-center
                  font-semibold text-lg pointer-events-none ${
                    bottomMessage.color === 'green' ? 'text-green-500' : 'text-red-500'
                  }`}>
    {bottomMessage.text}
  </div>
)}

  {/* Leg indicator flash */}
{/* Countdown 3 → 2 → 1 */}
{phase === 'countdown' && (
  <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
    <div className="bg-blue-600 text-white font-bold rounded
                    flex items-center justify-center"
         style={{ width: 110, height: 110, fontSize: 56 }}>
      {countdown}
    </div>
  </div>
)}

  {/* Briefing modal */}
  {phase === 'briefing' && (
    <div className="absolute inset-0 flex items-center justify-center z-20">
      <BriefingModal
        title="Next leg"
        lines={briefingLines}
        onClose={() => setPhase('running')}
      />
    </div>
  )}

  {/* Pause banner */}
  {phase === 'paused' && (
    <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
      <div className="bg-blue-600 text-white font-bold text-2xl py-4 px-8
                      w-2/3 text-center rounded">
        Pause
      </div>
    </div>
  )}
</div>
  </div>
);
}