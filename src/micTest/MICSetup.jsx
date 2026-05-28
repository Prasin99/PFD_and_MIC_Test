import React, { useState, useEffect } from 'react';                       // line 1 (updated)
import { MIC_LEVELS, MIC_DEFAULT_LEVEL_ID } from './legs';   

/**
 * MIC Setup / briefing.
 * Pick one of the three presets, tick the instruments + listening task to
 * include, set a duration, then Start.
 *
 * Calls onStart(config) when the user confirms.
 */
export function MICSetup({ onStart }) {
  const [levelId, setLevelId] = useState(MIC_DEFAULT_LEVEL_ID);
  const [activeInstruments, setActiveInstruments] = useState({
    heading: true,
    altitude: true,
    airspeed: true,
  });
  
  const [listeningTask, setListeningTask] = useState(true);
  const [duration, setDuration] = useState(60);

  useEffect(() => {
  if (levelId === 'maintain') {
    setActiveInstruments((prev) => ({ ...prev, airspeed: false }));
  }
}, [levelId]);

  const level = MIC_LEVELS.find((l) => l.id === levelId);

  const toggleInstrument = (key) =>
    setActiveInstruments((prev) => ({ ...prev, [key]: !prev[key] }));

 const handleStart = () => {
  const activeList = Object.entries(activeInstruments)
    .filter(([, on]) => on)
    .map(([k]) => k);

  if (activeList.length === 0) {
    alert('Please activate at least one instrument.');
    return;
  }

  // Prime speech synthesis — must run during the user gesture (click)
  if ('speechSynthesis' in window) {
    const prime = new SpeechSynthesisUtterance('');
    prime.volume = 0;
    window.speechSynthesis.speak(prime);
  }

  onStart({ level, activeInstruments: activeList, listeningTask, duration });
};

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8 flex justify-center">
      <div className="max-w-3xl w-full space-y-8">
        <header>
          <h1 className="text-3xl font-bold">
            Monitoring and Instrument Coordination
          </h1>
          <p className="text-slate-300 mt-2">
            Links a simplified instrument flight task with an optional
            listening task. Pick a difficulty preset and choose which
            instruments to include.
          </p>
        </header>

        {/* Difficulty preset */}
        <section>
          <h2 className="text-xl font-semibold mb-3">Difficulty preset</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {MIC_LEVELS.map((lvl) => {
              const selected = lvl.id === levelId;
              return (
                <button
                  key={lvl.id}
                  onClick={() => setLevelId(lvl.id)}
                  className={[
                    'text-left p-4 rounded-lg border transition',
                    selected
                      ? 'border-green-500 bg-slate-800 ring-2 ring-green-500'
                      : 'border-slate-700 bg-slate-800/60 hover:bg-slate-800',
                  ].join(' ')}
                >
                  <div className="font-semibold">{lvl.name}</div>
                  <div className="text-xs text-slate-400 mt-1 capitalize">
                    {lvl.difficulty}
                  </div>
                </button>
              );
            })}
          </div>
          <p className="text-sm text-slate-400 mt-3">{level.description}</p>
        </section>

        {/* Instruments */}
        <section>
          <h2 className="text-xl font-semibold mb-3">Active instruments</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { key: 'heading',  label: 'Heading (Compass)'    },
              { key: 'altitude', label: 'Altitude (Altimeter)' },
              { key: 'airspeed', label: 'Airspeed Indicator'   },
            ].map(({ key, label }) => (
              <label
                key={key}
                className="flex items-center gap-3 p-3 rounded-lg
                           bg-slate-800 border border-slate-700 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={activeInstruments[key]}
                  onChange={() => toggleInstrument(key)}
                  className="w-4 h-4 accent-green-500"
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </section>

        {/* Listening */}
        <section>
          <h2 className="text-xl font-semibold mb-3">Listening task</h2>
          <label className="flex items-center gap-3 p-3 rounded-lg
                            bg-slate-800 border border-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={listeningTask}
              onChange={() => setListeningTask((v) => !v)}
              className="w-4 h-4 accent-green-500"
            />
            <span>Include listening task (three odd → red / three even → green)</span>
          </label>
        </section>

        {/* Duration */}
        <section>
          <h2 className="text-xl font-semibold mb-3">Duration</h2>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={30}
              max={300}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-24 p-2 rounded bg-slate-800 border border-slate-700 text-white"
            />
            <span className="text-slate-400">seconds</span>
          </div>
        </section>

        <div>
          <button
            onClick={handleStart}
            className="px-6 py-3 rounded-lg bg-green-600 hover:bg-green-500
                       font-semibold transition"
          >
            Start MIC test
          </button>
        </div>
      </div>
    </div>
  );
}