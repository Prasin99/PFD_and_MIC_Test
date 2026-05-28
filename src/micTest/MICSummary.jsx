// import React, { useMemo } from 'react';
// import { MIC_CONFIG } from './micConfig';

// function pct(samples, key, threshold) {
//   if (!samples.length) return 0;
//   const n = samples.filter((s) => s[key] <= threshold).length;
//   return Math.round((n / samples.length) * 100);
// }
// function avg(samples, key) {
//   if (!samples.length) return 0;
//   return samples.reduce((a, s) => a + s[key], 0) / samples.length;
// }

// export function MICSummary({ result, onTryAgain, onDone }) {
//   if (!result) {
//     return (
//       <div className="min-h-screen bg-slate-900 text-white p-8 flex flex-col items-center gap-4">
//         <p>Session exited.</p>
//         <button onClick={onRestart}
//           className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600">
//           Back to setup
//         </button>
//       </div>
//     );
//   }

//   const { level, activeInstruments, listeningTask, samples, listeningResults } = result;
//   const tol = MIC_CONFIG.tolerance;

//   const rows = useMemo(() => ([
//     { key: 'heading',  label: 'Heading',  devKey: 'headingDev',  unit: '°',  t: tol.heading  },
//     { key: 'altitude', label: 'Altitude', devKey: 'altitudeDev', unit: 'ft', t: tol.altitude },
//     { key: 'airspeed', label: 'Airspeed', devKey: 'airspeedDev', unit: 'kt', t: tol.airspeed },
//   ]), [tol]);

//   return (
//     <div className="min-h-screen bg-slate-900 text-white p-8 flex justify-center">
//       <div className="max-w-3xl w-full space-y-8">
//         <header>
//           <h1 className="text-3xl font-bold">MIC Session Summary</h1>
//           <p className="text-slate-300 mt-1">{level.name}</p>
//         </header>

//         {/* Per-instrument */}
//         <section>
//           <h2 className="text-xl font-semibold mb-3">Flight task</h2>
//           <table className="w-full text-sm border-collapse">
//             <thead className="text-slate-400">
//               <tr>
//                 <th className="text-left p-2">Instrument</th>
//                 <th className="text-right p-2">Avg dev</th>
//                 <th className="text-right p-2">In green</th>
//                 <th className="text-right p-2">In yellow</th>
//               </tr>
//             </thead>
//             <tbody>
//               {rows.map((row) => {
//                 const active = activeInstruments.includes(row.key);
//                 if (!active) return (
//                   <tr key={row.key} className="opacity-40 border-t border-slate-700">
//                     <td className="p-2">{row.label}</td>
//                     <td colSpan={3} className="text-right p-2 italic">inactive</td>
//                   </tr>
//                 );
//                 const a = avg(samples, row.devKey);
//                 const g = pct(samples, row.devKey, row.t.green);
//                 const y = pct(samples, row.devKey, row.t.yellow);
//                 return (
//                   <tr key={row.key} className="border-t border-slate-700">
//                     <td className="p-2">{row.label}</td>
//                     <td className="text-right p-2">{a.toFixed(1)} {row.unit}</td>
//                     <td className="text-right p-2 text-green-400">{g}%</td>
//                     <td className="text-right p-2 text-yellow-400">{y}%</td>
//                   </tr>
//                 );
//               })}
//             </tbody>
//           </table>
//         </section>

//         {/* Listening */}
//         {listeningTask && listeningResults && (
//           <section>
//             <h2 className="text-xl font-semibold mb-3">Listening task</h2>
//             <div className="grid grid-cols-3 gap-3">
//               <Stat label="Correct" value={listeningResults.correct} color="text-green-400" />
//               <Stat label="Missed"  value={listeningResults.missed}  color="text-yellow-400" />
//               <Stat label="Wrong"   value={listeningResults.wrong}   color="text-red-400" />
//             </div>
//           </section>
//         )}

//         <button onClick={onRestart}
//           className="px-6 py-3 rounded-lg bg-green-600 hover:bg-green-500 font-semibold">
//           Run again
//         </button>
//       </div>
//     </div>
//   );
// }

// function Stat({ label, value, color }) {
//   return (
//     <div className="p-4 rounded-lg bg-slate-800 border border-slate-700">
//       <div className="text-xs text-slate-400">{label}</div>
//       <div className={`text-2xl font-bold ${color}`}>{value}</div>
//     </div>
//   );
// }


import React from 'react';

export function MICSummary({ onDone }) {
  return (
    <div className="w-screen h-screen bg-[#1a1a1a] text-white flex flex-col items-center justify-center gap-8">
      <h1 className="text-3xl font-bold">Session Complete</h1>
      <button
        onClick={onDone}
        className="px-10 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded transition"
      >
        Start Again
      </button>
    </div>
  );
}