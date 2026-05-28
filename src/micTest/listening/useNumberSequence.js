import { useEffect, useRef } from 'react';
import { useSpeechSynthesis } from './useSpeechSynthesis';

/**
 * Speaks a number in `range` every `intervalMs` while `enabled` is true.
 * Calls onNumber(n) right when the number is spoken (used by triplet
 * detection to anchor the response window).
 */
export function useNumberSequence({
   enabled,
  range = [1, 9],
  intervalMs = 3500,
  lang = 'en-US',
  rate = 0.5,           // ← new
  onNumber,
}) {
  const { speak, cancel } = useSpeechSynthesis({ lang, rate });   // ← pass rate
  const onNumberRef = useRef(onNumber);
  onNumberRef.current = onNumber;

useEffect(() => {
  if (!enabled) return undefined;
  const [lo, hi] = range;

  const speakOne = () => {
    const n = lo + Math.floor(Math.random() * (hi - lo + 1));
    onNumberRef.current?.(n);
    speak(n);
  };

  speakOne();                                    // ← speak first number immediately
  const id = setInterval(speakOne, intervalMs);
  return () => { clearInterval(id); cancel(); };
}, [enabled, range, intervalMs, speak, cancel]);
}