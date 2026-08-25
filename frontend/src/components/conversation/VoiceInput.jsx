import { Mic, MicOff, Loader } from 'lucide-react';
import { useVoiceInput } from '../../hooks/useVoiceInput.js';

export function VoiceInput({ language, onTranscript, onVoiceBlob }) {
  const handleTranscript = (result, isBlob) => {
    if (isBlob) onVoiceBlob?.(result);
    else onTranscript?.(result);
  };

  const { startRecording, stopRecording, isRecording, isProcessing } = useVoiceInput({
    language,
    onTranscript: handleTranscript,
  });

  const handleClick = () => {
    if (isRecording) stopRecording();
    else startRecording();
  };

  return (
    <button
      onClick={handleClick}
      className="btn btn-icon"
      aria-label={isRecording ? 'Stop recording' : 'Start voice input'}
      style={{
        background: isRecording ? '#EF4444' : 'var(--color-primary)',
        color: '#fff',
        animation: isRecording ? 'recordingPulse 1.5s ease-in-out infinite' : 'none',
        transition: 'background 0.2s',
      }}
      disabled={isProcessing}
    >
      {isProcessing ? (
        <Loader size={20} className="animate-spin" aria-hidden="true" />
      ) : isRecording ? (
        <MicOff size={20} aria-hidden="true" />
      ) : (
        <Mic size={20} aria-hidden="true" />
      )}
    </button>
  );
}
