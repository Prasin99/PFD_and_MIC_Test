import React, { useMemo, useRef } from 'react';

/**
 * Vertical speed tape — STATIC scale, moving pins.
 *
 * Same architecture as AltitudeTape:
 *   - Tape scale is FIXED at anchor ± tapeSpan (anchor = first target = base).
 *   - BLUE pin moves up/down with current value; color = tolerance state.
 *   - GREEN target ring + ▶ arrow move up/down with the target.
 *   - Tolerance bands move with the target.
 *   - Off-screen chevrons appear when value or target leaves the window.
 */
export function SpeedTape({
  value,
  target,
  tolerance,
  tapeSpan = 35,
  majorStep = 5,
  minorStep = 1,
  width = 100,
  height = 360,
  label = 'SPEED',
  inactive = false,
  outOfTolerance = false,
  pinLevel = 'green',
}) {
  const scale = height / (2 * tapeSpan);

  const anchorRef = useRef(target);
  const anchor = anchorRef.current;

  const yAt = (V) => height / 2 + (anchor - V) * scale;

  const ticks = useMemo(() => {
    const out = [];
    const min = anchor - tapeSpan;
    const max = anchor + tapeSpan;
    for (let v = Math.ceil(min / minorStep) * minorStep; v <= max; v += minorStep) {
      const isMajor = Math.abs(v % majorStep) < 1e-6;
      out.push({ v, y: yAt(v), isMajor });
    }
    return out;
  }, [anchor, tapeSpan, minorStep, majorStep, scale]);

  const greenTop  = yAt(target + tolerance.green);
  const greenBot  = yAt(target - tolerance.green);
  const yellowTop = yAt(target + tolerance.yellow);
  const yellowBot = yAt(target - tolerance.yellow);

  const targetY = yAt(target);
  const valueY  = inactive ? height / 2 : yAt(value);

  const valueAbove  = !inactive && value  > anchor + tapeSpan;
  const valueBelow  = !inactive && value  < anchor - tapeSpan;
  const targetAbove = !inactive && target > anchor + tapeSpan;
  const targetBelow = !inactive && target < anchor - tapeSpan;
  const valueOff    = valueAbove  || valueBelow;
  const targetOff   = targetAbove || targetBelow;

  const pinColor =
      pinLevel === 'red'    ? '#ef4444'
    : pinLevel === 'yellow' ? '#eab308'
    :                         '#2563eb';

  return (
    <div className="relative select-none" style={{ width, height: height + 40 }}>
      <div
        className="text-blue-700 font-semibold text-center text-sm"
        style={{ height: 20 }}
      >
        {label}
      </div>

      <div
        className="relative bg-white border border-gray-300 overflow-hidden"
        style={{ width, height, opacity: inactive ? 0.45 : 1 }}
      >
        <div style={{
          position: 'absolute', left: 30, width: 6,
          top: yellowTop, height: yellowBot - yellowTop, background: '#fde68a',
        }} />
        <div style={{
          position: 'absolute', left: 30, width: 6,
          top: greenTop, height: greenBot - greenTop, background: '#86efac',
        }} />
        <div style={{
          position: 'absolute', left: 30, width: 6,
          top: yellowTop - 6, height: 6, background: '#ef4444',
        }} />
        <div style={{
          position: 'absolute', left: 30, width: 6,
          top: yellowBot, height: 6, background: '#ef4444',
        }} />

        {ticks.map(({ v, y, isMajor }) => (
          <React.Fragment key={v}>
            <div style={{
              position: 'absolute',
              left: isMajor ? 44 : 52,
              width: isMajor ? width - 50 : width - 60,
              top: y - 0.5, height: 1, background: '#374151',
            }} />
            {isMajor && (
              <div style={{
                position: 'absolute',
                left: 0, top: y - 7, width: 28,
                fontSize: 11,
                fontFamily: 'ui-monospace, monospace',
                color: '#111827', textAlign: 'right',
              }}>
                {v}
              </div>
            )}
          </React.Fragment>
        ))}

        {!targetOff && (
          <div style={{
            position: 'absolute', left: width - 30, top: targetY - 9,
            width: 18, height: 18,
            border: '2.5px solid #16a34a',
            borderRadius: '50%',
            zIndex: 2,
          }} />
        )}

        {!targetOff && (
          <div style={{
            position: 'absolute', top: targetY - 7, left: 0,
            color: '#16a34a', fontSize: 14, zIndex: 3,
            lineHeight: '14px', fontWeight: 700,
          }}>
            ▶
          </div>
        )}

        {/* BLUE current-value pin — moves with value, color = tolerance */}
        {!valueOff && (
          <div style={{
            position: 'absolute', top: valueY - 3, left: width - 32,
            width: 28, height: 6, background: pinColor, zIndex: 4,
          }} />
        )}

        {targetOff && (
          <div
            style={{
              position: 'absolute',
              left: width - 36,
              ...(targetAbove ? { top: 2 } : { bottom: 2 }),
              fontSize: 11,
              fontFamily: 'ui-monospace, monospace',
              color: '#16a34a',
              fontWeight: 700,
              background: 'rgba(255,255,255,0.85)',
              padding: '1px 4px',
              borderRadius: 3,
              zIndex: 3,
              textAlign: 'center',
              minWidth: 32,
            }}
          >
            {targetAbove ? '▲' : '▼'} {Math.round(target)}
          </div>
        )}

        {valueOff && (
          <div
            style={{
              position: 'absolute',
              left: 4,
              ...(valueAbove ? { top: 2 } : { bottom: 2 }),
              fontSize: 11,
              fontFamily: 'ui-monospace, monospace',
              color: pinColor,
              fontWeight: 700,
              background: 'rgba(255,255,255,0.85)',
              padding: '1px 4px',
              borderRadius: 3,
              zIndex: 4,
              textAlign: 'center',
              minWidth: 32,
            }}
          >
            {valueAbove ? '▲' : '▼'} {Math.round(value)}
          </div>
        )}

        {outOfTolerance && !inactive && (
          <div className="absolute inset-0 pointer-events-none" style={{
            boxShadow: 'inset 0 0 0 2px #ef4444',
          }} />
        )}
      </div>

      <div
        className="absolute text-center text-xs font-mono text-green-300 bg-gray-800 border border-gray-700"
        style={{ left: '50%', transform: 'translateX(-50%)', bottom: 0, padding: '1px 8px', minWidth: 50 }}
      >
        {Math.round(target)}
      </div>
    </div>
  );
}
