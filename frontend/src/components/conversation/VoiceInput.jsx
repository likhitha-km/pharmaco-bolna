import { Mic, Square, Loader } from 'lucide-react';

/**
 * The composer's microphone control. Deliberately a labelled pill rather
 * than a bare icon so voice is the obvious way in — but it only dictates
 * into the composer; the user still reviews and sends.
 */
export function VoiceInput({ voice, disabled, languageLabel }) {
  const { isListening, isBusy, state, supported } = voice;

  const handleClick = () => {
    if (isListening) voice.stop();
    else voice.start();
  };

  const label = isListening ? 'Stop' : state === 'transcribing' ? 'Transcribing' : state === 'requesting' ? 'Allow mic' : 'Speak';

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`composer-mic${isListening ? ' is-listening' : ''}`}
      aria-label={isListening ? 'Stop recording and review the transcript' : `Speak your message in ${languageLabel}`}
      aria-pressed={isListening}
      disabled={disabled || isBusy || !supported}
      title={supported ? undefined : 'Voice input is not supported in this browser'}
    >
      {isBusy ? <Loader size={18} className="animate-spin" aria-hidden="true" /> : isListening ? <Square size={16} aria-hidden="true" /> : <Mic size={18} aria-hidden="true" />}
      <span className="composer-mic-label">{label}</span>
    </button>
  );
}
