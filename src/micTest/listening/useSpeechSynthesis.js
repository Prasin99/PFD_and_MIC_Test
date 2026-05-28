import { useCallback, useEffect, useRef, useState } from 'react';

export function useSpeechSynthesis({ lang = 'en-US', rate = 0.9, pitch = 1 } = {}) {
  const supportedRef = useRef(typeof window !== 'undefined' && 'speechSynthesis' in window);
  const [voice, setVoice] = useState(null);

  // Pick best available voice once the list is populated
  useEffect(() => {
    if (!supportedRef.current) return;

    const pickVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length === 0) return;
      const langPrefix = lang.slice(0, 2);

      const best =
        // macOS premium / enhanced voices (very natural)
        voices.find(v => v.lang.startsWith(langPrefix) && /Samantha|Karen|Daniel|Moira|Tessa|Fiona/i.test(v.name)) ||
        // Chrome's Google voices (good quality, cloud-based)
        voices.find(v => v.lang.startsWith(langPrefix) && /Google/i.test(v.name)) ||
        // Microsoft Edge neural voices
        voices.find(v => v.lang.startsWith(langPrefix) && /Natural|Neural|Aria|Jenny|Guy/i.test(v.name)) ||
        // Any non-local (cloud) voice for the language
        voices.find(v => v.lang === lang && !v.localService) ||
        // Exact lang match
        voices.find(v => v.lang === lang) ||
        // Same language family
        voices.find(v => v.lang.startsWith(langPrefix)) ||
        voices[0];

      setVoice(best);
    };

    pickVoice();
    window.speechSynthesis.addEventListener('voiceschanged', pickVoice);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', pickVoice);
  }, [lang]);


  // Chrome auto-pause workaround — keep the synthesis engine awake
useEffect(() => {
  if (!supportedRef.current) return;
  const id = setInterval(() => {
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    } else if (!window.speechSynthesis.speaking) {
      // Tickle the engine to prevent silent shutdown
      window.speechSynthesis.resume();
    }
  }, 5000);
  return () => clearInterval(id);
}, []);

  const speak = useCallback((text) => {
      console.log('[speak]', text, 'voice:', voice?.name, 'supported:', supportedRef.current);

    if (!supportedRef.current) return;
    // Cancel any pending speech so numbers don't queue up and overlap
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text));
    u.lang = lang;
    u.rate = rate;
    u.pitch = pitch;
    if (voice) u.voice = voice;
    window.speechSynthesis.speak(u);
  }, [lang, rate, pitch, voice]);

  const cancel = useCallback(() => {
    if (!supportedRef.current) return;
    window.speechSynthesis.cancel();
  }, []);

  return { speak, cancel, supported: supportedRef.current };
}