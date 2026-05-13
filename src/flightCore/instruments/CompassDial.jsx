import React, { useMemo } from 'react';

/**
 * Round compass dial — sample round-dial instrument provided as a template
 * for the MIC / Gubsomat / PIT modules, which use the classic round-gauge
 * presentation rather than the PFD tape style.
 *
 * The dial rotates so that the current heading appears at the top under a
 * fixed aircraft symbol, matching how a real magnetic compass card behaves.
 *
 * To build the rest of the round-dial set (AirspeedDial, AltimeterDial,
 * ClockDial), copy this file's structure: an SVG with a static face plate,
 * a rotating/swept needle, and tolerance/target marks where applicable.
 */
export function CompassDial({
  value,
  target,
  tolerance,
  size = 200,
  inactive = false,
  outOfTolerance = false,
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 4;

  // Major labels every 30° (N, 3, 6, E, 12, 15, S, 21, 24, W, 30, 33)
  const labels = useMemo(
    () => [
      { deg: 0,   text: 'N' },
      { deg: 30,  text: '3' },
      { deg: 60,  text: '6' },
      { deg: 90,  text: 'E' },
      { deg: 120, text: '12' },
      { deg: 150, text: '15' },
      { deg: 180, text: 'S' },
      { deg: 210, text: '21' },
      { deg: 240, text: '24' },
      { deg: 270, text: 'W' },
      { deg: 300, text: '30' },
      { deg: 330, text: '33' },
    ],
    []
  );

  // Tick marks every 5°
  const ticks = useMemo(() => {
    const out = [];
    for (let d = 0; d < 360; d += 5) {
      const major = d % 30 === 0;
      out.push({ deg: d, major });
    }
    return out;
  }, []);

  // Card rotates so that current heading is at top
  const cardRotation = -value;

  return (
    <div className="relative" style={{ width: size, height: size, opacity: inactive ? 0.45 : 1 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Outer face */}
        <circle cx={cx} cy={cy} r={r} fill="#1f2937" stroke="#111827" strokeWidth={2} />

        {/* Rotating card */}
        <g transform={`rotate(${cardRotation} ${cx} ${cy})`}>
          {ticks.map(({ deg, major }) => {
            const a = (deg - 90) * Math.PI / 180;
            const r1 = r - (major ? 12 : 6);
            const r2 = r - 2;
            return (
              <line
                key={deg}
                x1={cx + Math.cos(a) * r1}
                y1={cy + Math.sin(a) * r1}
                x2={cx + Math.cos(a) * r2}
                y2={cy + Math.sin(a) * r2}
                stroke="white"
                strokeWidth={major ? 2 : 1}
              />
            );
          })}
          {labels.map(({ deg, text }) => {
            const a = (deg - 90) * Math.PI / 180;
            const lr = r - 24;
            const x = cx + Math.cos(a) * lr;
            const y = cy + Math.sin(a) * lr;
            return (
              <text
                key={deg}
                x={x}
                y={y}
                fill="white"
                fontSize={deg % 90 === 0 ? 16 : 12}
                fontFamily="ui-monospace, monospace"
                textAnchor="middle"
                dominantBaseline="middle"
                transform={`rotate(${-cardRotation} ${x} ${y})`}
              >
                {text}
              </text>
            );
          })}

          {/* Target marker — green dot on the rotating card at the target heading */}
          {tolerance && (() => {
            const a = (target - 90) * Math.PI / 180;
            const tr = r - 4;
            return (
              <circle
                cx={cx + Math.cos(a) * tr}
                cy={cy + Math.sin(a) * tr}
                r={4}
                fill="#22c55e"
              />
            );
          })()}
        </g>

        {/* Fixed aircraft symbol at top (always points up) */}
        <path
          d={`M ${cx} ${cy - r + 22} L ${cx - 12} ${cy - r + 38} L ${cx} ${cy - r + 32} L ${cx + 12} ${cy - r + 38} Z`}
          fill="white"
          stroke="white"
        />
        <line x1={cx} y1={cy - r + 22} x2={cx} y2={cy + r - 22} stroke="white" strokeWidth={1.5} />

        {outOfTolerance && !inactive && (
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#ef4444" strokeWidth={3} />
        )}
      </svg>
    </div>
  );
}
