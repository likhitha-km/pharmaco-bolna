import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, X, Globe, Volume2, VolumeX, Save, Mic, RotateCcw, AlertCircle, Phone, Trash2 } from 'lucide-react';
import { ChatBubble } from './ChatBubble.jsx';
import { VoiceInput } from './VoiceInput.jsx';
import { ReportCheckCard } from './ReportCheckCard.jsx';
import { EmergencyAlert } from '../common/EmergencyAlert.jsx';
import { showToast } from '../common/Toast.jsx';
import { useConversation } from '../../hooks/useConversation.js';
import { useVoiceInput } from '../../hooks/useVoiceInput.js';
import { useSpeaker } from '../../hooks/useSpeaker.js';
import { useReportProgress } from '../../hooks/useReportProgress.js';
import { LANGUAGES, tSafety } from '../../utils/i18n.js';
import { messageKey } from '../../utils/messages.js';

const AUTO_READ_KEY = 'pharmaco_auto_read';

function readAutoRead() {
  try { return localStorage.getItem(AUTO_READ_KEY) === '1'; } catch { return false; }
}

function formatTime(secs) {
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
}

export function ConversationWindow({ onReportReady, language, userType, onLanguageChange }) {
  const {
    messages, isLoading, isEmergency, isReportReady, extractedData,
    sendMessage, resetConversation, startConversation, saveForLater,
  } = useConversation();
  const progress = useReportProgress(extractedData);
  const [showReadyCard, setShowReadyCard] = useState(isReportReady);
  const [input, setInput] = useState('');
  const [voiceDraft, setVoiceDraft] = useState(null); // { engine } while the composer holds a dictated transcript
  const [placeholder, setPlaceholder] = useState('Type, or tap Speak to talk in your language…');
  const [autoRead, setAutoRead] = useState(readAutoRead);
  const [savingLater, setSavingLater] = useState(false);
  const [emergencyCollapsed, setEmergencyCollapsed] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const textareaRef = useRef(null);
  const scrollRef = useRef(null);
  const lastSpokenRef = useRef(null);

  const langLabel = LANGUAGES.find((l) => l.code === language)?.native || language;
  const speaker = useSpeaker(language);

  const voice = useVoiceInput({
    language,
    onResult: (text) => {
      setInput((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
      setVoiceDraft({ engine: voice.engine });
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.focus();
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
      });
    },
  });

  useEffect(() => { setShowReadyCard(isReportReady); }, [isReportReady]);

  // Keep the newest message (or the check card) in view — scroll the panel,
  // not the page.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, showReadyCard, isEmergency]);

  // Optional: read each new assistant reply aloud.
  useEffect(() => {
    if (!autoRead || !speaker.available) return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== 'assistant' || last.isLoading || !last.content) return;
    const key = messageKey(last, messages.length - 1);
    if (lastSpokenRef.current === key) return;
    lastSpokenRef.current = key;
    speaker.speak(key, last.content);
  }, [messages, autoRead, speaker]);

  const missingLabels = useMemo(
    () => progress.fields.filter((f) => !f.filled && !f.required).map((f) => f.label.toLowerCase()),
    [progress.fields],
  );

  const resizeTextarea = (el) => {
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    const inputMode = voiceDraft ? 'voice' : 'text';
    setInput('');
    setVoiceDraft(null);
    setPlaceholder('Type, or tap Speak to talk in your language…');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    await sendMessage(text, { inputMode });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const discardVoiceDraft = () => {
    setInput('');
    setVoiceDraft(null);
  };

  const reRecord = () => {
    discardVoiceDraft();
    voice.start();
  };

  const toggleAutoRead = () => {
    const next = !autoRead;
    setAutoRead(next);
    try { localStorage.setItem(AUTO_READ_KEY, next ? '1' : '0'); } catch { /* ignore */ }
    if (!next) speaker.stop();
    else if (messages.length) lastSpokenRef.current = messageKey(messages[messages.length - 1], messages.length - 1); // don't replay the current message
  };

  const handleSaveLater = async () => {
    setSavingLater(true);
    try {
      const result = await saveForLater();
      if (!result.saved) showToast('Could not save right now. Please check your connection.', 'error');
      else if (result.draft) showToast('Saved. Continue any time from My Reports.', 'success');
      else showToast('Your conversation is saved. Come back to Report ADR on this device to continue.', 'success');
    } catch {
      showToast('Could not save right now. Please try again.', 'error');
    } finally {
      setSavingLater(false);
    }
  };

  const handleCorrect = () => {
    setPlaceholder('Tell me what to correct, e.g. “the dose was 250 mg”…');
    textareaRef.current?.focus();
  };

  const handleAddMissing = () => sendMessage('I can answer the remaining questions now.');

  const handleReadSummary = () => {
    const idx = [...messages].reverse().findIndex((m) => m.role === 'assistant' && m.content);
    if (idx === -1) return;
    const realIdx = messages.length - 1 - idx;
    speaker.speak(messageKey(messages[realIdx], realIdx), messages[realIdx].content);
  };

  const handleStartNew = async () => {
    speaker.stop();
    voice.cancel();
    resetConversation();
    setShowReadyCard(false);
    setConfirmRestart(false);
    setEmergencyCollapsed(false);
    setInput('');
    setVoiceDraft(null);
    setPlaceholder('Type, or tap Speak to talk in your language…');
    lastSpokenRef.current = null;
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    await startConversation(userType, language, true);
  };

  const listening = voice.isListening;
  const transcribing = voice.state === 'transcribing';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Messages */}
      <div
        ref={scrollRef}
        style={{ flex: 1, overflowY: 'auto', padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}
        aria-live="polite" aria-label="Conversation"
      >
        {messages.map((msg, i) => {
          const key = messageKey(msg, i);
          const bot = msg.role === 'assistant';
          return (
            <ChatBubble
              key={key}
              message={msg.content}
              role={msg.role}
              timestamp={msg.timestamp}
              isLoading={msg.isLoading}
              isVoice={msg.isVoice}
              onSpeak={bot && speaker.available && msg.content && !msg.isLoading ? () => speaker.speak(key, msg.content) : undefined}
              speaking={speaker.speakingKey === key}
              speakLoading={speaker.loadingKey === key}
            />
          );
        })}
        {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
          <ChatBubble role="assistant" isLoading />
        )}
        {showReadyCard && !isLoading && (
          <ReportCheckCard
            extractedData={extractedData}
            missingLabels={missingLabels}
            onConfirm={onReportReady}
            onCorrect={handleCorrect}
            onAddMissing={handleAddMissing}
            onSaveLater={handleSaveLater}
            onReadAloud={handleReadSummary}
            canReadAloud={speaker.available}
            onStartNew={handleStartNew}
            saving={savingLater}
          />
        )}
      </div>

      {/* Emergency guidance stays pinned above the composer so it can't scroll away. */}
      {isEmergency && (emergencyCollapsed ? (
        <div className="emergency-bar" role="alert">
          <strong>{tSafety('emergencyBar', language)}</strong>
          <a href="tel:112"><Phone size={13} aria-hidden="true" /> 112</a>
          <a href="tel:108"><Phone size={13} aria-hidden="true" /> {tSafety('ambulance', language)}</a>
          <button type="button" onClick={() => setEmergencyCollapsed(false)}>{tSafety('showAdvice', language)}</button>
        </div>
      ) : (
        <div className="emergency-pinned">
          <EmergencyAlert language={language} onContinue={() => setEmergencyCollapsed(true)} />
        </div>
      ))}

      {/* Composer */}
      <div className="composer">
        {voice.error && (
          <div className="composer-notice is-error" role="alert">
            <AlertCircle size={15} aria-hidden="true" />
            <span style={{ flex: 1 }}>{voice.error}</span>
            <button type="button" onClick={voice.clearError} aria-label="Dismiss"><X size={14} /></button>
          </div>
        )}
        {confirmRestart && (
          <div className="composer-notice is-review" role="alertdialog" aria-label="Clear conversation">
            <Trash2 size={15} aria-hidden="true" />
            <span style={{ flex: 1 }}>
              <strong>Clear this conversation and start over?</strong> Messages so far will be removed from this chat. Anything you saved as a draft stays in My Reports.
            </span>
            <button type="button" onClick={handleStartNew} disabled={isLoading}><RotateCcw size={13} aria-hidden="true" /> Clear &amp; restart</button>
            <button type="button" onClick={() => setConfirmRestart(false)}><X size={13} aria-hidden="true" /> Cancel</button>
          </div>
        )}
        {voiceDraft && !listening && !transcribing && (
          <div className="composer-notice is-review" role="status">
            <Mic size={15} aria-hidden="true" />
            <span style={{ flex: 1 }}>
              <strong>Check what we heard.</strong> Edit anything that’s wrong, then press Send.
              <span style={{ opacity: 0.75 }}> · {voiceDraft.engine === 'sarvam' ? 'Transcribed by Sarvam' : 'Browser speech recognition'}</span>
            </span>
            <button type="button" onClick={reRecord}><RotateCcw size={13} aria-hidden="true" /> Re-record</button>
            <button type="button" onClick={discardVoiceDraft}><X size={13} aria-hidden="true" /> Discard</button>
          </div>
        )}

        <div className="composer-row">
          <VoiceInput voice={voice} disabled={isLoading} languageLabel={langLabel} />

          {listening || transcribing ? (
            <div className="composer-listening" role="status" aria-live="polite">
              {listening ? (
                <>
                  <span className="listening-dot" aria-hidden="true" />
                  <span className="listening-bars" aria-hidden="true"><i /><i /><i /><i /><i /></span>
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {voice.interim || <>Listening in <strong>{langLabel}</strong>. Tap Stop when you’re done</>}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text-muted)' }}>{formatTime(voice.elapsed)} / {formatTime(voice.maxSeconds)}</span>
                  <button type="button" className="composer-cancel" onClick={voice.cancel} aria-label="Cancel recording"><X size={16} /></button>
                </>
              ) : (
                <span>Turning your speech into text…</span>
              )}
            </div>
          ) : (
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                if (!e.target.value.trim()) setVoiceDraft(null);
                resizeTextarea(e.target);
              }}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              rows={1}
              aria-label="Your message"
              className={`composer-input${voiceDraft ? ' is-voice' : ''}`}
            />
          )}

          <button
            className="btn btn-icon btn-primary"
            onClick={handleSend}
            disabled={!input.trim() || isLoading || listening || transcribing}
            aria-label="Send message"
          >
            <ArrowRight size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="composer-tools">
          <label className="composer-tool">
            <Globe size={14} aria-hidden="true" />
            <span className="sr-only">Language</span>
            <select value={language} onChange={(e) => onLanguageChange?.(e.target.value)} aria-label="Conversation language" disabled={listening || transcribing}>
              {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.native}</option>)}
            </select>
          </label>
          {speaker.available && (
            <button type="button" className={`composer-tool${autoRead ? ' is-on' : ''}`} onClick={toggleAutoRead} aria-pressed={autoRead}>
              {autoRead ? <Volume2 size={14} aria-hidden="true" /> : <VolumeX size={14} aria-hidden="true" />}
              Read replies aloud
            </button>
          )}
          <button type="button" className="composer-tool" onClick={handleSaveLater} disabled={savingLater}>
            <Save size={14} aria-hidden="true" /> {savingLater ? 'Saving…' : 'Save & finish later'}
          </button>
          <button type="button" className="composer-tool" onClick={() => setConfirmRestart(true)} disabled={isLoading || listening || transcribing || messages.length === 0}>
            <Trash2 size={14} aria-hidden="true" /> Clear &amp; restart
          </button>
          <span className="composer-hint">Speak or type. You can switch any time.</span>
        </div>
      </div>
    </div>
  );
}
