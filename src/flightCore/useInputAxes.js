import { useEffect, useRef } from 'react';

/**
 * Control inputs — joystick has priority, keyboard is the fallback.
 *
 *   PITCH (altitude up / down)
 *     joystick axis 1 (pull back = climb)   primary
 *     ArrowUp / ArrowDown                   fallback
 *
 *   ROLL (heading left / right)
 *     joystick axis 0                       primary
 *     ArrowLeft / ArrowRight                fallback
 *
 *   THROTTLE (speed up / down)
 *     standard gamepad: triggers (buttons 6 / 7) and shoulders (4 / 5)
 *     HOTAS:            axis 3 absolute slider, plus buttons 4-7 as digital
 *     D-pad up / down   (buttons 12 / 13) — extra digital fallback
 *     Q / A keys                            keyboard fallback
 *
 * Priority rule: for a given channel, if the joystick has any input
 * outside its deadzone, that input wins — keyboard is ignored on that
 * channel until the stick returns to center.
 */
export function useInputAxes(initialThrottle = 0.5) {
  const axesRef = useRef({ pitch: 0, roll: 0, throttle: initialThrottle });
  const keysRef = useRef(new Set());

  const sliderRef = useRef({
    initialised: false,
    last: 0,
    active: false,
  });

  useEffect(() => {
    const onDown = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const k = e.key.toLowerCase();
      keysRef.current.add(k);

      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'q', 'a', ' '].includes(k)) {
        e.preventDefault();
      }
    };

    const onUp = (e) => {
      keysRef.current.delete(e.key.toLowerCase());
    };

    const onBlur = () => {
      keysRef.current.clear();
    };

    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', onBlur);

    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  const poll = (dt) => {
    const a = axesRef.current;
    const k = keysRef.current;

    // ── Keyboard ────────────────────────────────────────────────────────────
    let kbPitch = 0;
    let kbRoll = 0;
    let kbThrDelta = 0;

    if (k.has('arrowup')) kbPitch += 1;
    if (k.has('arrowdown')) kbPitch -= 1;
    if (k.has('arrowright')) kbRoll += 1;
    if (k.has('arrowleft')) kbRoll -= 1;

    if (k.has('q')) kbThrDelta += dt * 0.25;
    if (k.has('a')) kbThrDelta -= dt * 0.25;

    // ── Gamepad / joystick ─────────────────────────────────────────────────
    let gpPitch = 0;
    let gpRoll = 0;
    let gpThrDelta = 0;
    let gpAbsThrottle = null;
    let gpActivePitch = false;
    let gpActiveRoll  = false;

    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = Array.from(pads).find((p) => p && p.connected);

    if (pad) {
  const DZ = 0.08;
  const dz = (v) => (Math.abs(v) < DZ ? 0 : v);

  // Logitech Extreme 3D Pro axis layout (and most similar HOTAS):
  //   axis 0 — stick X (roll → heading)
  //   axis 1 — stick Y (pitch → altitude, negated so pull-back = climb)
  //   axis 6 — throttle slider on the base
  gpRoll  =  dz(pad.axes[0] ?? 0);
  //gpPitch = -dz(pad.axes[1] ?? 0);
  gpPitch = dz(pad.axes[1] ?? 0); // pull back = climb (Logitech 3D Pro: axis 1 +ve when pulled back)

  gpActivePitch = gpPitch !== 0;
  gpActiveRoll  = gpRoll  !== 0;

  // Throttle slider on axis 6.
  //   raw = -1 (slider pushed all the way forward / "up") → throttle = 1
  //   raw = +1 (slider pulled all the way back / "down")  → throttle = 0
  // If your hardware reports the opposite direction, flip to `(raw + 1) / 2`.
  if (typeof pad.axes[6] === 'number') {
    const raw = pad.axes[6];
    const sl = sliderRef.current;
    if (!sl.initialised) {
      sl.last = raw;
      sl.initialised = true;
    } else if (Math.abs(raw - sl.last) > 0.02) {
      sl.active = true;
      sl.last = raw;
    }
    if (sl.active) {
      gpAbsThrottle = clamp01((1 - raw) / 2);
    }
  }

  // Trigger / shoulder buttons as a small extra throttle nudge
  // (handy for fine adjustments without moving the slider)
  const btnUp =
    (pad.buttons[5]?.pressed ? 1 : 0) ||
    (pad.buttons[7]?.pressed ? 1 : 0);
  const btnDown =
    (pad.buttons[4]?.pressed ? 1 : 0) ||
    (pad.buttons[6]?.pressed ? 1 : 0);
  gpThrDelta += (btnUp - btnDown) * dt * 0.35;
}

    // ── Combine pitch / roll: joystick PRIORITY ─────────────────────────────
    // If the stick is moved (outside the deadzone) on a channel, it wins;
    // otherwise the keyboard takes over. This gives the joystick "priority"
    // the user asked for — but the keyboard is still usable whenever the
    // stick is at rest.
    a.pitch = gpActivePitch ? gpPitch : kbPitch;
    a.roll  = gpActiveRoll  ? gpRoll  : kbRoll;

    // ── Throttle ───────────────────────────────────────────────────────────
    // HOTAS absolute slider wins outright. Otherwise sum deltas from
    // joystick triggers / buttons / D-pad and from Q / A.
    if (gpAbsThrottle !== null) {
      a.throttle = gpAbsThrottle;
    } else {
      a.throttle = clamp01(a.throttle + kbThrDelta + gpThrDelta);
    }

    return a;
  };

  const setThrottle = (v) => {
    axesRef.current.throttle = clamp01(v);

    // If the user uses the on-screen throttle UI, temporarily release HOTAS
    // slider lock until the physical slider is moved again.
    sliderRef.current.active = false;
  };

  return { axesRef, poll, setThrottle };
}

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}