import React, { useMemo, useRef } from 'react';
import { angularDiff } from '../flightDynamics.js';

/**
 * Horizontal heading tape — STATIC scale, moving pins.
 *
 * Same architecture as the vertical tapes but on the X axis, with
 * circular-difference math to handle the 359° → 0° wrap.
 *
 *   - Scale is FIXED at anchor ± tapeSpan degrees. Tick labels stay put.
 *     Around north the labels read e.g. … 355, 0, 5, 10 … even though the
 *     internal coordinate is signed.
 *   - BLUE pin moves left/right with current heading; color = tolerance state.
 *   - GREEN target ring (inside tape) + ▲ arrow (below tape) move with target.
 *   - Off-screen chevrons (◀ / ▶) appear on the edge where the value or
 *     target lies when it's outside the static window.
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
  pinLevel = 'green',
}) {
  const scale = width / (2 * tapeSpan);

  // Anchor = first target = base heading (e.g. 0). Static window centers here.
  const anchorRef = useRef(target);
  const anchor = anchorRef.current;

  // Map a heading to viewport X via signed circular delta from anchor.
  const xAt = (deltaDeg) => width / 2 + deltaDeg * scale;

  const valueDelta  = inactive ? 0 : angularDiff(value,  anchor);
  const targetDelta = inactive ? 0 : angularDiff(target, anchor);

  const valueX  = xAt(valueDelta);
  const targetX = xAt(targetDelta);

  const ticks = useMemo(() => {
    const out = [];
    // Iterate in signed delta-from-anchor space so positions are stable.
    const min = -tapeSpan;
    const max =  tapeSpan;
    const first = Math.ceil(min / minorStep) * minorStep;
    for (let d = first; d <= max; d += minorStep) {
      // Label is the absolute heading (anchor + d) wrapped to [0, 360).
      const absHdg  = ((anchor + d) % 360 + 360) % 360;
      const isMajor = Math.abs(absHdg % majorStep) < 1e-6
                   || Math.abs((absHdg % majorStep) - majorStep) < 1e-6;
      out.push({
        labelText: absHdg,
        x: xAt(d),
        isMajor,
      });
    }
    return out;
  }, [anchor, tapeSpan, minorStep, majorStep, scale]);

  // Tolerance bands relative to target's screen position.
  const greenLeft   = targetX - tolerance.green  * scale;
  const greenRight  = targetX + tolerance.green  * scale;
  const yellowLeft  = targetX - tolerance.yellow * scale;
  const yellowRight = targetX + tolerance.yellow * scale;

  // Off-screen detection.
  const valueRight  = !inactive && valueDelta  >  tapeSpan;
  const valueLeft   = !inactive && valueDelta  < -tapeSpan;
  const targetRight = !inactive && targetDelta >  tapeSpan;
  const targetLeft  = !inactive && targetDelta < -tapeSpan;
  const valueOff    = valueLeft  || valueRight;
  const targetOff   = targetLeft || targetRight;

  const pinColor =
      pinLevel === 'red'    ? '#ef4444'
    : pinLevel === 'yellow' ? '#eab308'
    :                         '#2563eb';

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

        {/* Tolerance bands — move with target's screen X */}
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

        {/* Static tick marks and labels */}
        {ticks.map(({ labelText, x, isMajor }, i) => (
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
                {labelText}
              </div>
            )}
          </React.Fragment>
        ))}

        {/* Green target ring inside the tape — moves with target */}
        {!targetOff && (
          <div style={{
            position: 'absolute',
            top: 2, left: targetX - 9,
            width: 18, height: 18,
            border: '2.5px solid #16a34a',
            borderRadius: '50%',
            zIndex: 2,
          }} />
        )}

        {/* BLUE current-value pin — moves with value, color = tolerance */}
        {!valueOff && (
          <div style={{
            position: 'absolute',
            left: valueX - 2, top: 14, bottom: 14, width: 4,
            background: pinColor, zIndex: 4,
          }} />
        )}

        {/* Off-screen TARGET indicator */}
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

        {/* Off-screen VALUE indicator — opposite-color chevron */}
        {valueOff && (
          <div
            style={{
              position: 'absolute',
              bottom: 4,
              ...(valueRight ? { right: 4 } : { left: 4 }),
              fontSize: 11,
              fontFamily: 'ui-monospace, monospace',
              color: pinColor,
              fontWeight: 700,
              background: 'rgba(255,255,255,0.85)',
              padding: '1px 4px',
              borderRadius: 3,
              zIndex: 4,
              textAlign: 'center',
              minWidth: 36,
            }}
          >
            {valueRight ? '▶' : '◀'} {String(Math.round(value)).padStart(3, '0')}
          </div>
        )}

        {outOfTolerance && !inactive && (
          <div className="absolute inset-0 pointer-events-none" style={{
            boxShadow: 'inset 0 0 0 2px #ef4444',
          }} />
        )}
      </div>

      {/* Green target arrow UNDER the tape — co-located with target ring */}
      {!targetOff && (
        <div
          className="absolute"
          style={{
            left: targetX - 6,
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
