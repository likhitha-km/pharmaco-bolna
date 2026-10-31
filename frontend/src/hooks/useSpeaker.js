import { useCallback, useEffect, useRef, useState } from 'react';
import { voiceApi } from '../utils/api.js';

/**
 * Reads assistant replies aloud with Sarvam Bulbul (via /api/voice/tts) —
 * the same "Priya" voice the phone agent uses. If the server has no TTS,
 * `available` turns false and callers hide their speaker controls.
 */
export function useSpeaker(language) {
  const [speakingKey, setSpeakingKey] = useState(null);
  const [loadingKey, setLoadingKey] = useState(null);
  const [available, setAvailable] = useState(true);
  const audioRef = useRef(null);
  const cacheRef = useRef(new Map());

  const stop = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    setSpeakingKey(null);
  }, []);

  const speak = useCallback(async (key, text) => {
    if (!text) return;
    if (speakingKey === key) { stop(); return; }
    stop();
    const cacheKey = `${language}:${text}`;
    try {
      let audio = cacheRef.current.get(cacheKey);
      if (!audio) {
        setLoadingKey(key);
        const { data } = await voiceApi.tts(text, language);
        audio = data.audio;
        cacheRef.current.set(cacheKey, audio);
      }
      const el = new Audio(`data:audio/wav;base64,${audio}`);
      audioRef.current = el;
      el.onended = () => setSpeakingKey((k) => (k === key ? null : k));
      setSpeakingKey(key);
      await el.play();
    } catch (err) {
      if (err.response?.status === 503) setAvailable(false);
      setSpeakingKey(null);
    } finally {
      setLoadingKey(null);
    }
  }, [language, speakingKey, stop]);

  useEffect(() => () => audioRef.current?.pause(), []);

  return { speak, stop, speakingKey, loadingKey, available };
}
