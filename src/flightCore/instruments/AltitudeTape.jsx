import React, { useMemo, useRef } from 'react';

/**
 * Vertical altitude tape (SkyTest PFD-style).
 *
 *   - Tape is anchored to CURRENT VALUE — the blue actual-value bar stays
 *     fixed at the viewport center while the tape scrolls behind it.
 *   - The GREEN target ring (rendered on the tape) scrolls with the tape,
 *     so it shows where the target sits relative to current value.
 *   - The GREEN ▶ edge arrow tracks the target's screen Y — co-located with
 *     the green ring, like SkyTest.
 *   - Tolerance bands (green / yellow / red caps) are anchored to the target
 *     on the inner tape body, so they scroll with the target.
 *   - When the target lies outside the visible ±tapeSpan window, the
 *     inline green arrow hides and an off-screen indicator with the
 *     numeric target appears at the top or bottom edge.
 *
 * `inactive` greys out the tape and freezes value at target.
 */
export function AltitudeTape({
  value,
  target,
  tolerance,            // { green, yellow }
  tapeSpan = 200,       // ±units visible in the viewport
  majorStep = 100,
  minorStep = 10,
  width = 100,
  height = 360,
  label = 'ALTITUDE',
  inactive = false,
  outOfTolerance = false,
}) {
  const scale = height / (2 * tapeSpan);          // px per unit
  // Render a generous tick band so even far-away targets keep ticks visible.
  //const renderRange = 1500;
  const renderRange = 5000;   // was 1500 — keeps ticks visible even on big excursions
  const totalHeight = renderRange * 2 * scale;

  // STABLE anchor captured on first render. The tick `useMemo` previously
  // depended on `target`, which drifts every frame in consistent/irregular
  // modes — causing all 400+ tick <div>s to re-render every frame and
  // produce visible shake. The screen Y of any tick is
  // `height/2 + (value − v) × scale` regardless of the anchor used inside
  // the inner, so anchoring ticks to a fixed value gives identical visuals
  // with zero per-frame DOM thrashing.
  const anchorRef = useRef(target);
  const anchor = anchorRef.current;

  // Tape Y for value V (Y=0 is top of the inner tape body):
  //   Y(V) = (anchor + renderRange - V) * scale
  // To put VALUE at viewport center (height/2):
  const translateY = inactive
    ? height / 2 - (anchor + renderRange - target) * scale  // freeze on target
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

  // Tolerance band Y ranges (anchored to DYNAMIC target so they scroll with it)
  const yAt = (V) => (anchor + renderRange - V) * scale;
  const greenTop  = yAt(target + tolerance.green);
  const greenBot  = yAt(target - tolerance.green);
  const yellowTop = yAt(target + tolerance.yellow);
  const yellowBot = yAt(target - tolerance.yellow);
  const targetY   = yAt(target);

  // Off-screen target indicator: when target lies outside the visible
  // ±tapeSpan window around `value`, show a chevron at the top or bottom
  // edge of the tape with the target value.
  const targetOffset = target - value;             // ft
  const targetAbove  = targetOffset >  tapeSpan;
  const targetBelow  = targetOffset < -tapeSpan;
  const targetOff    = !inactive && (targetAbove || targetBelow);

  // Target's Y in viewport coords (for the inline green ▶ arrow).
  // Derivation: target's screen Y = renderRange*scale + translateY
  //           = height/2 + (value - target) * scale  (when not inactive)
  // When inactive, target lives at viewport center.
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
          {/* Tolerance band column (yellow under green, red caps) */}
          <div style={{
            position: 'absolute', left: 30, width: 6,
            top: yellowTop, height: yellowBot - yellowTop,
            background: '#fde68a',
          }} />
          <div style={{
            position: 'absolute', left: 30, width: 6,
            top: greenTop, height: greenBot - greenTop,
            background: '#86efac',
          }} />
          <div style={{
            position: 'absolute', left: 30, width: 6,
            top: yellowTop - 6, height: 6, background: '#ef4444',
          }} />
          <div style={{
            position: 'absolute', left: 30, width: 6,
            top: yellowBot, height: 6, background: '#ef4444',
          }} />

          {/* Tick marks and labels */}
          {ticks.map(({ v, y, isMajor }) => (
            <React.Fragment key={v}>
              <div style={{
                position: 'absolute',
                left: isMajor ? 44 : 52,
                width: isMajor ? width - 50 : width - 60,
                top: y - 0.5, height: 1,
                background: '#374151',
              }} />
              {isMajor && (
                <div style={{
                  position: 'absolute',
                  left: 0, top: y - 7,
                  width: 28,
                  fontSize: 11,
                  fontFamily: 'ui-monospace, monospace',
                  color: '#111827', textAlign: 'right',
                }}>
                  {v}
                </div>
              )}
            </React.Fragment>
          ))}

          {/* Target ring — sits on the tape, scrolls with target */}
          <div style={{
            position: 'absolute',
            left: width - 30, top: targetY - 9,
            width: 18, height: 18,
            border: '2.5px solid #16a34a',
            borderRadius: '50%',
          }} />
        </div>

        {/* Fixed-at-center: blue current indicator */}
        <div style={{
          position: 'absolute',
          top: height / 2 - 3, left: width - 32,
          width: 28, height: 6, background: '#2563eb', zIndex: 2,
        }} />

        {/* Green target arrow on the LEFT edge — co-located with target circle.
            Hidden when target is fully off-screen (handled by the off-screen
            indicator below). */}
        {!targetOff && (
          <div style={{
            position: 'absolute',
            top: targetViewportY - 7, left: 0,
            color: '#16a34a', fontSize: 14, zIndex: 3,
            lineHeight: '14px', fontWeight: 700,
          }}>
            ▶
          </div>
        )}

        {/* OFF-SCREEN TARGET INDICATOR */}
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

      {/* Target value chip below */}
      <div
        className="absolute text-center text-xs font-mono text-green-300 bg-gray-800 border border-gray-700"
        style={{ left: '50%', transform: 'translateX(-50%)', bottom: 0, padding: '1px 8px', minWidth: 50 }}
      >
        {Math.round(target)}
      </div>
    </div>
  );
}
