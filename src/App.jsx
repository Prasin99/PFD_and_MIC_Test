import React, { useState, useCallback } from 'react';
import { PFDTrackingSetup } from './pfdTracking/PFDTrackingSetup.jsx';
import { PFDTrackingTraining } from './pfdTracking/PFDTrackingTraining.jsx';
import { PFDTrackingSummary } from './pfdTracking/PFDTrackingSummary.jsx';

/**
 * Standalone shell. Inside the LMS, the course config mounts
 * <PFDTrackingTraining/> directly with its own settings — this App is for
 * dev / preview / standalone testing.
 */
export default function App() {
  const [phase, setPhase] = useState('setup'); // 'setup' | 'training' | 'summary'
  const [settings, setSettings] = useState(null);
  const [result, setResult] = useState(null);

  const handleStart = useCallback((s) => {
    setSettings(s);
    setResult(null);
    setPhase('training');
  }, []);

  const handleComplete = useCallback((r) => {
    setResult(r);
    setPhase('summary');
  }, []);

  const handleExit = useCallback(() => {
    setPhase('setup');
  }, []);

  const handleTryAgain = useCallback(() => {
    setPhase('training');
  }, []);

  const handleDone = useCallback(() => {
    setPhase('setup');
  }, []);

  if (phase === 'setup') {
    return <PFDTrackingSetup onStart={handleStart} defaults={{ durationMin: 4 }} />;
  }

  if (phase === 'training') {
    return (
      <div className="w-screen h-screen overflow-hidden">
        <PFDTrackingTraining
          settings={settings}
          onComplete={handleComplete}
          onExit={handleExit}
        />
      </div>
    );
  }

  return (
    <PFDTrackingSummary
      result={result}
      onTryAgain={handleTryAgain}
      onDone={handleDone}
    />
  );
}
