import { useEffect, useRef } from 'react';

/**
 * RAF loop with bounded dt. Calls onTick(dt) every frame while
 * runningRef.current === true. Pause/resume just flips the ref —
 * the loop itself never stops, so timing stays continuous.
 */
export function useFlightLoop(onTick, runningRef) {
  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const step = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); // cap to avoid huge dt after tab switch
      last = now;
      if (runningRef.current) onTickRef.current(dt);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [runningRef]);
}
