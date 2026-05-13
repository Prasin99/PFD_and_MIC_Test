import React from 'react';

/**
 * Post-task summary. Shows per-channel time-in-band breakdown, RMS error,
 * and an overall fraction-green score. Try Again resets back to setup,
 * Done returns to the parent (LMS or App root).
 */
export function PFDTrackingSummary({ result, onTryAgain, onDone }) {
  const { duration, results } = result ?? {};
  const channels = ['altitude', 'heading', 'speed'].filter(
    (c) => results?.[c] && results[c].totalTime > 0.5
  );

  const overallPct = Math.round(((results?.overall ?? 0) * 100));

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="bg-white rounded-lg shadow border border-gray-200 max-w-xl w-full p-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">Session complete</h1>
        <p className="text-sm text-gray-500 mb-6">
          Total time: {Math.round(duration ?? 0)}s
        </p>

        <div className="mb-6 p-4 bg-blue-50 rounded border border-blue-100">
          <div className="text-sm text-blue-900 font-medium">Overall in-tolerance</div>
          <div className="text-3xl font-bold text-blue-700 mt-1">{overallPct}%</div>
          <div className="text-xs text-blue-600 mt-1">
            Fraction of active time spent within the green tolerance band.
          </div>
        </div>

        <div className="space-y-4">
          {channels.map((c) => {
            const r = results[c];
            const pct = Math.round(r.fractionGreen * 100);
            const tg = Math.round(r.timeInGreen);
            const ty = Math.round(r.timeInYellow);
            const tr = Math.round(r.timeInRed);
            const total = Math.max(1, r.totalTime);
            const wG = (r.timeInGreen  / total) * 100;
            const wY = (r.timeInYellow / total) * 100;
            const wR = (r.timeInRed    / total) * 100;
            const unit = c === 'altitude' ? 'ft' : c === 'speed' ? 'kt' : '°';

            return (
              <div key={c} className="border border-gray-200 rounded p-4">
                <div className="flex items-baseline justify-between">
                  <div className="font-medium text-gray-900 capitalize">{c}</div>
                  <div className="text-sm text-gray-500">
                    RMS error: <span className="font-mono">{r.rmsError.toFixed(1)}{unit}</span>
                  </div>
                </div>
                <div className="mt-3 flex h-3 rounded overflow-hidden bg-gray-100">
                  <div style={{ width: `${wG}%`, background: '#22c55e' }} />
                  <div style={{ width: `${wY}%`, background: '#fbbf24' }} />
                  <div style={{ width: `${wR}%`, background: '#ef4444' }} />
                </div>
                <div className="mt-2 flex gap-4 text-xs text-gray-600">
                  <span><span className="inline-block w-2 h-2 bg-green-500 mr-1" />Green {tg}s ({pct}%)</span>
                  <span><span className="inline-block w-2 h-2 bg-amber-400 mr-1" />Yellow {ty}s</span>
                  <span><span className="inline-block w-2 h-2 bg-red-500 mr-1" />Red {tr}s</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex gap-3">
          <button
            className="flex-1 px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded"
            onClick={onTryAgain}
          >
            Try again
          </button>
          <button
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
            onClick={onDone}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
