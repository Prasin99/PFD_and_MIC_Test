import React, { useMemo, useRef } from 'react';
import { angularDiff } from '../flightDynamics.js';

/**
 * Horizontal heading tape (SkyTest PFD-style).
 *
 *   - Tape is anchored to CURRENT VALUE (blue stays at viewport center).
 *   - GREEN target ring scrolls with the target on the tape.
 *   - GREEN ▲ arrow under the tape tracks the target's screen X — when
 *     target = 9° and value = 35°, the arrow sits under the "10" tick on
 *     the tape, just like SkyTest.
 *   - Circular-difference math handles the 359° → 0° wrap.
 *   - Off-screen indicator at left / right edge when target is more than
 *     `tapeSpan` degrees away from value (circularly).
 */
export function HeadingTape({
  value,
  target,
  tolerance,
  tapeSpan = 35,
  majorStep = 5,
  minorStep = 1,
  width = 720,
  height = 80,
  label = 'HEADING',
  inactive = false,
  outOfTolerance = false,
}) {
  const scale = width / (2 * tapeSpan);
  const renderRange = 200;
  const totalWidth = renderRange * 2 * scale;

  // STABLE anchor captured on first render — prevents per-frame re-render
  // of every tick <div> when target drifts. See AltitudeTape for the full
  // implementation note; same idea here, in heading degrees.
  const anchorRef = useRef(target);
  const anchor = anchorRef.current;

  // Circular diff so we don't jump 350 → 10 when crossing north.
  const angDiff   = inactive ? 0 : angularDiff(value, anchor);    // signed [-180, 180]
  const translateX = width / 2 - (renderRange + angDiff) * scale;

  const ticks = useMemo(() => {
  const out = [];
  const min = anchor - renderRange;
  const max = anchor + renderRange;
  const first = Math.ceil(min / minorStep) * minorStep;
  for (let h = first; h <= max; h += minorStep) {
    const label   = ((h % 360) + 360) % 360;
    const isMajor = Math.abs(((label % majorStep) + majorStep) % majorStep) < 1e-6;
    out.push({
      label,
      x: (h - anchor + renderRange) * scale,   // smooth scroll, no relabeling
      isMajor,
    });
  }
  return out;
}, [anchor, renderRange, minorStep, majorStep, scale]);

  // Target ring + tolerance bands — position via DYNAMIC target relative to
  // the stable anchor, so they scroll with target on the tape inner.
  const targetSignedFromAnchor = angularDiff(target, anchor);
  const xAt = (deltaDeg) => (targetSignedFromAnchor + deltaDeg + renderRange) * scale;
  const greenLeft   = xAt(-tolerance.green);
  const greenRight  = xAt(tolerance.green);
  const yellowLeft  = xAt(-tolerance.yellow);
  const yellowRight = xAt(tolerance.yellow);
  const targetX     = xAt(0);

  const fmt = (v) => String(Math.round(v));

  // Off-screen indicator: target lies outside the visible window when the
  // signed circular difference exceeds tapeSpan.
  const targetSignedDelta = angularDiff(target, value);
  const targetRight = !inactive && targetSignedDelta >  tapeSpan;
  const targetLeft  = !inactive && targetSignedDelta < -tapeSpan;
  const targetOff   = targetLeft || targetRight;

  // Target's X in viewport coords (for the inline green ▲ arrow).
  // Derivation: target's screen X = renderRange*scale + translateX
  //           = width/2 + angularDiff(target, value) * scale  (when not inactive)
  const targetViewportX = inactive
    ? width / 2
    : width / 2 + targetSignedDelta * scale;

  return (
    <div className="relative select-none" style={{ width, height: height + 40 }}>
      <div className="text-blue-700 font-semibold text-center text-sm" style={{ height: 20 }}>
        {label}
      </div>

      <div
        className="relative bg-white border border-gray-300 overflow-hidden"
        style={{ width, height, opacity: inactive ? 0.45 : 1 }}
      >
        {/* Right-side target value chip */}
        <div
          className="absolute text-xs font-mono text-green-300 bg-gray-800 border border-gray-700 z-20"
          style={{ right: 4, top: 4, padding: '1px 6px' }}
        >
          {String(Math.round(target)).padStart(3, '0')}
        </div>

        <div
          style={{
            position: 'absolute',
            top: 0, bottom: 0,
            width: totalWidth,
            transform: `translateX(${translateX}px)`,
            willChange: 'transform',
          }}
        >
          <div style={{
            position: 'absolute', top: 6, height: 6,
            left: yellowLeft, width: yellowRight - yellowLeft, background: '#fde68a',
          }} />
          <div style={{
            position: 'absolute', top: 6, height: 6,
            left: greenLeft, width: greenRight - greenLeft, background: '#86efac',
          }} />
          <div style={{
            position: 'absolute', top: 6, height: 6,
            left: yellowLeft - 6, width: 6, background: '#ef4444',
          }} />
          <div style={{
            position: 'absolute', top: 6, height: 6,
            left: yellowRight, width: 6, background: '#ef4444',
          }} />

          {ticks.map(({ label, x, isMajor }, i) => (
            <React.Fragment key={i}>
              <div style={{
                position: 'absolute',
                top: isMajor ? 16 : 22,
                height: isMajor ? height - 32 : height - 44,
                left: x - 0.5, width: 1, background: '#374151',
              }} />
              {isMajor && (
                <div style={{
                  position: 'absolute',
                  bottom: 4, left: x - 14, width: 28,
                  fontSize: 11,
                  fontFamily: 'ui-monospace, monospace',
                  color: '#111827', textAlign: 'center',
                }}>
                  {label}
                </div>
              )}
            </React.Fragment>
          ))}

          {/* Target ring on the tape (scrolls with target) */}
          <div style={{
            position: 'absolute',
            top: 2, left: targetX - 9,
            width: 18, height: 18,
            border: '2.5px solid #16a34a',
            borderRadius: '50%',
          }} />
        </div>

        {/* Fixed center: blue current indicator */}
        <div style={{
          position: 'absolute',
          left: width / 2 - 2, top: 14, bottom: 14, width: 4,
          background: '#2563eb', zIndex: 2,
        }} />

        {/* OFF-SCREEN TARGET INDICATOR */}
        {targetOff && (
          <div
            style={{
              position: 'absolute',
              top: 24,
              ...(targetRight ? { right: 4 } : { left: 4 }),
              fontSize: 11,
              fontFamily: 'ui-monospace, monospace',
              color: '#16a34a',
              fontWeight: 700,
              background: 'rgba(255,255,255,0.85)',
              padding: '1px 4px',
              borderRadius: 3,
              zIndex: 3,
              textAlign: 'center',
              minWidth: 36,
            }}
          >
            {targetRight ? '▶' : '◀'} {String(Math.round(target)).padStart(3, '0')}
          </div>
        )}

        {outOfTolerance && !inactive && (
          <div className="absolute inset-0 pointer-events-none" style={{
            boxShadow: 'inset 0 0 0 2px #ef4444',
          }} />
        )}
      </div>

      {/* Green target arrow UNDER the tape — co-located with target circle.
          Hidden when target is fully off-screen. */}
      {!targetOff && (
        <div
          className="absolute"
          style={{
            left: targetViewportX - 6,
            bottom: 18,
            color: '#16a34a',
            fontSize: 14,
            zIndex: 2,
            lineHeight: '14px',
            fontWeight: 700,
          }}
        >
          ▲
        </div>
      )}
    </div>
  );
}
