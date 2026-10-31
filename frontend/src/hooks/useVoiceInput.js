import { useState, useRef, useCallback, useEffect } from 'react';
import { conversationApi } from '../utils/api.js';

const MAX_SECONDS = 60;
const MIN_MS = 700;

function pickMimeType() {
  if (typeof MediaRecorder === 'undefined') return null;
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  return candidates.find((t) => MediaRecorder.isTypeSupported?.(t)) || '';
}

function micErrorMessage(err) {
  switch (err?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Microphone access is blocked. Allow it from your browser’s address bar, or type instead.';
    case 'NotFoundError':
      return 'No microphone was found on this device. You can type instead.';
    case 'NotReadableError':
      return 'Your microphone is being used by another app. Close it and try again, or type instead.';
    default:
      return 'Could not start the microphone. You can type instead.';
  }
}

/**
 * Dictation for the chat composer. Speech is turned into text and handed to
 * `onResult(text, engine)` for the user to review — it is never sent
 * automatically.
 *
 * Engines, in order of preference:
 *   'sarvam'  — record in the browser, transcribe on the server with Sarvam
 *               (best for Indian languages and code-mixed speech)
 *   'browser' — the browser's own speech recognition, used when Sarvam is
 *               unavailable or the browser can't record audio
 */
export function useVoiceInput({ language = 'hi-IN', onResult }) {
  const [state, setState] = useState('idle'); // idle | requesting | listening | transcribing
  const [elapsed, setElapsed] = useState(0);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState(null);
  const [sarvamUnavailable, setSarvamUnavailable] = useState(false);

  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const recognitionRef = useRef(null);
  const finalTextRef = useRef('');
  const timerRef = useRef(null);
  const startedAtRef = useRef(0);
  const cancelledRef = useRef(false);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;
  // Latest interim text, so browser recognition can fall back to it on end.
  const interimRef = useRef('');
  interimRef.current = interim;

  const BrowserRecognition = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
  const canRecord = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';
  const engine = canRecord && !sarvamUnavailable ? 'sarvam' : BrowserRecognition ? 'browser' : null;
  const supported = Boolean(engine);

  const stopTimer = () => {
    clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const releaseStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const startTimer = (onLimit) => {
    startedAtRef.current = Date.now();
    setElapsed(0);
    timerRef.current = setInterval(() => {
      const secs = Math.floor((Date.now() - startedAtRef.current) / 1000);
      setElapsed(secs);
      if (secs >= MAX_SECONDS) onLimit();
    }, 250);
  };

  const transcribe = async (blob, mimeType) => {
    setState('transcribing');
    try {
      const form = new FormData();
      const ext = mimeType.includes('mp4') ? 'm4a' : mimeType.includes('ogg') ? 'ogg' : 'webm';
      form.append('audio', blob, `speech.${ext}`);
      form.append('language', language);
      const { data } = await conversationApi.transcribe(form);
      onResultRef.current?.(data.transcript, 'sarvam');
    } catch (err) {
      const code = err.response?.data?.code;
      if (code === 'stt_not_configured' || code === 'stt_failed' || !err.response) {
        setSarvamUnavailable(true);
        setError(BrowserRecognition
          ? 'Server transcription is unavailable right now. Tap the mic again to use your browser’s speech recognition, or type instead.'
          : 'Voice transcription is unavailable right now. Please type your message instead.');
      } else {
        setError(err.response?.data?.error || 'We couldn’t transcribe that. Please try again or type instead.');
      }
    } finally {
      setState('idle');
    }
  };

  const startSarvam = async () => {
    setState('requesting');
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (err) {
      setState('idle');
      setError(micErrorMessage(err));
      return;
    }
    streamRef.current = stream;
    const mimeType = pickMimeType();
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    chunksRef.current = [];
    cancelledRef.current = false;
    recorder.ondataavailable = (e) => { if (e.data?.size) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      stopTimer();
      releaseStream();
      const duration = Date.now() - startedAtRef.current;
      if (cancelledRef.current) { setState('idle'); return; }
      if (duration < MIN_MS || !chunksRef.current.length) {
        setState('idle');
        setError('That was too short — tap the mic, speak, then tap Stop.');
        return;
      }
      const type = recorder.mimeType || mimeType || 'audio/webm';
      transcribe(new Blob(chunksRef.current, { type }), type);
    };
    recorderRef.current = recorder;
    recorder.start(250);
    setState('listening');
    startTimer(() => recorderRef.current?.state === 'recording' && recorderRef.current.stop());
  };

  const startBrowser = () => {
    const rec = new BrowserRecognition();
    rec.lang = language;
    rec.continuous = true;
    rec.interimResults = true;
    finalTextRef.current = '';
    cancelledRef.current = false;
    rec.onresult = (e) => {
      let finalText = '';
      let interimText = '';
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
        else interimText += e.results[i][0].transcript;
      }
      finalTextRef.current = finalText;
      setInterim(`${finalText} ${interimText}`.trim());
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') setError(micErrorMessage({ name: 'NotAllowedError' }));
      else if (e.error === 'no-speech') setError('We didn’t hear anything. Please try again.');
      else if (e.error !== 'aborted') setError('Speech recognition stopped unexpectedly. You can type instead.');
    };
    rec.onend = () => {
      stopTimer();
      const text = (finalTextRef.current || '').trim() || interimRef.current.trim();
      setInterim('');
      setState('idle');
      recognitionRef.current = null;
      if (!cancelledRef.current && text) onResultRef.current?.(text, 'browser');
    };
    recognitionRef.current = rec;
    try {
      rec.start();
      setState('listening');
      startTimer(() => recognitionRef.current?.stop());
    } catch {
      setError('Could not start speech recognition. You can type instead.');
    }
  };

  const start = useCallback(() => {
    setError(null);
    setInterim('');
    if (engine === 'sarvam') startSarvam();
    else if (engine === 'browser') startBrowser();
    else setError('Voice input isn’t supported in this browser. Please type instead.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, language]);

  const stop = useCallback(() => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    if (recognitionRef.current) recognitionRef.current.stop();
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    stop();
    stopTimer();
    releaseStream();
    setInterim('');
    setState('idle');
  }, [stop]);

  useEffect(() => () => {
    cancelledRef.current = true;
    stopTimer();
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    recognitionRef.current?.abort?.();
    releaseStream();
  }, []);

  return {
    state,
    isListening: state === 'listening',
    isBusy: state === 'requesting' || state === 'transcribing',
    elapsed,
    maxSeconds: MAX_SECONDS,
    interim,
    error,
    clearError: () => setError(null),
    engine,
    supported,
    start,
    stop,
    cancel,
  };
}
