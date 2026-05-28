import { useCallback, useRef, useState } from 'react';
import { useNumberSequence } from './useNumberSequence';

export function useTripletDetection({ enabled, config }) {
  const lastThreeRef = useRef([]);
  const pendingRef   = useRef(null);
  const resultsRef   = useRef({ correct: 0, missed: 0, wrong: 0 });
  const [results, setResults] = useState(resultsRef.current);
  const [lastCorrectAt, setLastCorrectAt] = useState(0);   // NEW
  const [lastWrongAt,   setLastWrongAt]   = useState(0);   // NEW

  const commit = () => setResults({ ...resultsRef.current });

  const handleNumber = useCallback((n) => {
    const buf = lastThreeRef.current;
    buf.push(n);
    if (buf.length > 3) buf.shift();

    // Expired pending window = silent miss (stat only, no message)
    if (pendingRef.current && performance.now() > pendingRef.current.deadline) {
      resultsRef.current.missed += 1;
      pendingRef.current = null;
      commit();
    }

    if (buf.length === 3) {
      const allOdd  = buf.every((x) => x % 2 === 1);
      const allEven = buf.every((x) => x % 2 === 0);
      if (allOdd || allEven) {
        pendingRef.current = {
          parity: allOdd ? 'odd' : 'even',
          deadline: performance.now() + config.responseWindowMs,
        };
      }
    }
  }, [config.responseWindowMs]);

  useNumberSequence({
    enabled,
    range: config.numberRange,
    intervalMs: config.intervalMs,
    lang: config.voiceLang,
    rate: config.voiceRate,
    onNumber: handleNumber,
  });

  const handlePress = (color) => {
    if (!enabled) return;
    const pend = pendingRef.current;

    // No active triplet — any press is wrong
    if (!pend || performance.now() > pend.deadline) {
      resultsRef.current.wrong += 1;
      setLastWrongAt(performance.now());
      pendingRef.current = null;
      commit();
      return;
    }

    const expected = pend.parity === 'odd' ? 'red' : 'green';
    if (color === expected) {
      resultsRef.current.correct += 1;
      setLastCorrectAt(performance.now());
    } else {
      resultsRef.current.wrong += 1;
      setLastWrongAt(performance.now());
    }
    pendingRef.current = null;
    commit();
  };

  return {
    pressRed:   () => handlePress('red'),
    pressGreen: () => handlePress('green'),
    results,
    lastCorrectAt,
    lastWrongAt,
  };
}