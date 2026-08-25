import { useState, useRef, useCallback } from 'react';

export function useVoiceInput({ language = 'hi-IN', onTranscript }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const startRecording = useCallback(() => {
    setTranscript('');

    // Try Web Speech API first
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.lang = language;
      rec.continuous = false;
      rec.interimResults = true;
      rec.maxAlternatives = 1;

      rec.onresult = (e) => {
        const result = e.results[e.results.length - 1];
        const text = result[0].transcript;
        setTranscript(text);
        if (result.isFinal) {
          onTranscript?.(text);
          setIsRecording(false);
        }
      };
      rec.onerror = () => { setIsRecording(false); setIsProcessing(false); };
      rec.onend = () => { setIsRecording(false); };

      recognitionRef.current = rec;
      rec.start();
      setIsRecording(true);
      return;
    }

    // Fallback: MediaRecorder for Sarvam STT
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      chunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => chunksRef.current.push(e.data);
      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setIsProcessing(true);
        setIsRecording(false);
        onTranscript?.(blob, true); // true = isBlob
        setIsProcessing(false);
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setIsRecording(true);
    }).catch(() => { console.warn('[VoiceInput] Mic access denied'); });
  }, [language, onTranscript]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  return { startRecording, stopRecording, isRecording, isProcessing, transcript };
}
