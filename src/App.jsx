// import React, { useState, useCallback } from 'react';
// import { PFDTrackingSetup } from './pfdTracking/PFDTrackingSetup.jsx';
// import { PFDTrackingTraining } from './pfdTracking/PFDTrackingTraining.jsx';
// import { PFDTrackingSummary } from './pfdTracking/PFDTrackingSummary.jsx';

// /**
//  * Standalone shell. Inside the LMS, the course config mounts
//  * <PFDTrackingTraining/> directly with its own settings — this App is for
//  * dev / preview / standalone testing.
//  */
// export default function App() {
//   const [phase, setPhase] = useState('setup'); // 'setup' | 'training' | 'summary'
//   const [settings, setSettings] = useState(null);
//   const [result, setResult] = useState(null);

  

//   const handleStart = useCallback((s) => {
//     setSettings(s);
//     setResult(null);
//     setPhase('training');
//   }, []);

//   const handleComplete = useCallback((r) => {
//     setResult(r);
//     setPhase('summary');
//   }, []);

//   const handleExit = useCallback(() => {
//     setPhase('setup');
//   }, []);

//   const handleTryAgain = useCallback(() => {
//     setPhase('training');
//   }, []);

//   const handleDone = useCallback(() => {
//     setPhase('setup');
//   }, []);

//   if (phase === 'setup') {
//     return <PFDTrackingSetup onStart={handleStart} defaults={{ durationMin: 4 }} />;
//   }

//   if (phase === 'training') {
//     return (
//       <div className="w-screen h-screen overflow-hidden">
//         <PFDTrackingTraining
//           settings={settings}
//           onComplete={handleComplete}
//           onExit={handleExit}
//         />
//       </div>
//     );
//   }

//   return (
//     <PFDTrackingSummary
//       result={result}
//       onTryAgain={handleTryAgain}
//       onDone={handleDone}
//     />
//   );
// }



import React, { useState, useCallback } from 'react';
import { PFDTrackingSetup }    from './pfdTracking/PFDTrackingSetup.jsx';
import { PFDTrackingTraining } from './pfdTracking/PFDTrackingTraining.jsx';
import { PFDTrackingSummary }  from './pfdTracking/PFDTrackingSummary.jsx';
import { MICSetup }    from './micTest/MICSetup.jsx';
import { MICTraining } from './micTest/MICTraining.jsx';
import { MICSummary }  from './micTest/MICSummary.jsx';

export default function App() {
  const [module, setModule] = useState(null);    // null | 'pfd' | 'mic'
  const [phase,  setPhase]  = useState('setup'); // 'setup' | 'training' | 'summary'
  const [settings, setSettings] = useState(null);
  const [result,   setResult]   = useState(null);

  const handleSelectModule = useCallback((m) => {
    setModule(m); setPhase('setup'); setSettings(null); setResult(null);
  }, []);

  const handleStart    = useCallback((s) => { setSettings(s); setResult(null); setPhase('training'); }, []);
  const handleComplete = useCallback((r) => { setResult(r); setPhase('summary'); }, []);
  const handleExit     = useCallback(() => { setPhase('setup'); }, []);
  const handleTryAgain = useCallback(() => { setPhase('training'); }, []);
  // const handleDone     = useCallback(() => { setPhase('setup'); }, []);
  const handleDone = useCallback(() => {
  setModule(null); setPhase('setup'); setSettings(null); setResult(null);
}, []);

  // ── Landing: module picker ──
  if (!module) return <ModulePicker onSelect={handleSelectModule} />;

  // ── PFD flow (unchanged) ──
  if (module === 'pfd') {
    if (phase === 'setup')    return <PFDTrackingSetup onStart={handleStart} defaults={{ durationMin: 4 }} />;
    if (phase === 'training') return (
      <div className="w-screen h-screen overflow-hidden">
        <PFDTrackingTraining settings={settings} onComplete={handleComplete} onExit={handleExit} />
      </div>
    );
    return <PFDTrackingSummary result={result} onTryAgain={handleTryAgain} onDone={handleDone} />;
  }

  // ── MIC flow ──
  if (module === 'mic') {
    if (phase === 'setup')    return <MICSetup onStart={handleStart} />;
    if (phase === 'training') return (
      <div className="w-screen h-screen overflow-hidden">
        <MICTraining settings={settings} onComplete={handleComplete} onExit={handleExit} />
      </div>
    );
    return <MICSummary result={result} onTryAgain={handleTryAgain} onDone={handleDone} />;
  }

  return null;
}

function ModulePicker({ onSelect }) {
  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center gap-8 p-8">
      <header className="text-center">
        <h1 className="text-4xl font-bold">Flight-Core Foundation</h1>
        <p className="text-slate-400 mt-2">Choose a test module</p>
      </header>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl w-full">
        <ModuleCard
          title="PFD Tracking Test"
          desc="Adjust altitude, heading and speed on a Primary Flight Display while target values change."
          onClick={() => onSelect('pfd')}
        />
        <ModuleCard
          title="MIC Test"
          desc="Monitoring and Instrument Coordination — round dial instruments with an optional listening task."
          onClick={() => onSelect('mic')}
        />
      </div>
    </div>
  );
}

function ModuleCard({ title, desc, onClick }) {
  return (
    <button
      onClick={onClick}
      className="text-left p-6 rounded-xl bg-slate-800 border border-slate-700
                 hover:bg-slate-700 hover:border-green-500 transition"
    >
      <div className="text-xl font-semibold">{title}</div>
      <div className="text-sm text-slate-400 mt-2">{desc}</div>
    </button>
  );
}