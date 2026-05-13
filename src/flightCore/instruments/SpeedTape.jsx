import React, { useMemo, useRef } from 'react';

/**
 * Vertical speed tape (SkyTest PFD-style).
 *
 * Same scrolling logic as AltitudeTape — value at viewport center, target
 * (green ring + edge arrow) scrolls with the target on the tape. Broken
 * out as a separate component because labels, units, and step sizes
 * differ.
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
}) {
  const scale = height / (2 * tapeSpan);
  const renderRange = 200;
  const totalHeight = renderRange * 2 * scale;

  // STABLE anchor captured on first render — prevents per-frame re-render
  // of all tick <div>s when target drifts. See AltitudeTape for full note.
  const anchorRef = useRef(target);
  const anchor = anchorRef.current;

  const translateY = inactive
    ? height / 2 - (anchor + renderRange - target) * scale
    : height / 2 - (anchor + renderRange - value)  * scale;

  const ticks = useMemo(() => {
    const out = [];
    const min = anchor - renderRange;
    const max = anchor + renderRange;
    for (let v = Math.ceil(min / minorStep) * minorStep; v <= max; v += minorStep) {
      const isMajor = Math.abs(v % majorStep) < 1e-6;
      out.push({ v, y: (anchor + renderRange - v) * scale, isMajor });
    }
    return out;
  }, [anchor, renderRange, minorStep, majorStep, scale]);

  const yAt = (V) => (anchor + renderRange - V) * scale;
  const greenTop  = yAt(target + tolerance.green);
  const greenBot  = yAt(target - tolerance.green);
  const yellowTop = yAt(target + tolerance.yellow);
  const yellowBot = yAt(target - tolerance.yellow);
  const targetY   = yAt(target);

  const targetOffset = target - value;
  const targetAbove  = targetOffset >  tapeSpan;
  const targetBelow  = targetOffset < -tapeSpan;
  const targetOff    = !inactive && (targetAbove || targetBelow);

  // Target's Y in viewport coords (for the inline green ▶ arrow on the
  // left edge of the speed tape, co-located with the green target ring).
  const targetViewportY = inactive
    ? height / 2
    : height / 2 + (value - target) * scale;

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
        <div
          style={{
            position: 'absolute',
            left: 0, right: 0, top: 0,
            height: totalHeight,
            transform: `translateY(${translateY}px)`,
            willChange: 'transform',
          }}
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

          <div style={{
            position: 'absolute', left: width - 30, top: targetY - 9,
            width: 18, height: 18,
            border: '2.5px solid #16a34a',
            borderRadius: '50%',
          }} />
        </div>

        {/* Fixed-at-center blue current indicator */}
        <div style={{
          position: 'absolute', top: height / 2 - 3, left: width - 32,
          width: 28, height: 6, background: '#2563eb', zIndex: 2,
        }} />

        {/* Green target arrow on the LEFT edge — co-located with target ring */}
        {!targetOff && (
          <div style={{
            position: 'absolute', top: targetViewportY - 7, left: 0,
            color: '#16a34a', fontSize: 14, zIndex: 3,
            lineHeight: '14px', fontWeight: 700,
          }}>
            ▶
          </div>
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
