import { useEffect, useRef, useState } from 'react';
import { ArrowRight, X } from 'lucide-react';
import { ChatBubble } from './ChatBubble.jsx';
import { VoiceInput } from './VoiceInput.jsx';
import { EmergencyAlert } from '../common/EmergencyAlert.jsx';
import { useConversation } from '../../hooks/useConversation.js';

export function ConversationWindow({ onReportReady, language, userType }) {
  const { messages, isLoading, isEmergency, isReportReady, sendMessage, sendVoice, resetConversation, startConversation } = useConversation();
  const [showReadyBanner, setShowReadyBanner] = useState(isReportReady);
  const [input, setInput] = useState('');
  const textareaRef = useRef(null);
  const bottomRef = useRef(null);

  // Update banner visibility when report ready state changes
  useEffect(() => {
    setShowReadyBanner(isReportReady);
  }, [isReportReady]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    await sendMessage(input.trim());
    setInput('');
  };

  const handleTranscript = async (transcript) => {
    if (transcript) {
      await sendMessage(transcript);
    }
  };

  const handleVoiceBlob = async (blob) => {
    if (blob) {
      await sendVoice(blob);
    }
  };

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);


  const handleDismiss = async () => {
    resetConversation();
    setShowReadyBanner(false);
    // Immediately start a fresh conversation so user can continue typing
    await startConversation(userType, language, true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Messages */}
      <div
        style={{ flex: 1, overflowY: 'auto', padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}
        aria-live="polite" aria-label="Conversation"
      >
        {isEmergency && <EmergencyAlert />}
        {messages.map((msg, i) => (
          <ChatBubble
            key={i}
            message={msg.content}
            role={msg.role}
            timestamp={msg.timestamp}
            isLoading={msg.isLoading}
          />
        ))}
        {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
          <ChatBubble role="assistant" isLoading />
        )}
        <div ref={bottomRef} />
      </div>

      {/* Report ready banner */}
      {showReadyBanner && (
        <div style={{
          margin: '0 20px 12px', padding: '14px 20px',
          background: '#ECFDF5', border: '1px solid #10B981', borderRadius: 'var(--radius-lg)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <p style={{ fontWeight: 600, fontSize: 15, color: '#059669' }}>Your report is ready to review</p>
            <p style={{ fontSize: 13, color: '#065F46' }}>All required information collected</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={onReportReady}>
              Review & Submit
            </button>
            <button className="btn btn-ghost btn-sm" onClick={handleDismiss} aria-label="Dismiss ready banner">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Input area */}
      <div style={{
        padding: '16px 20px', background: 'var(--color-surface)',
        borderTop: '1px solid var(--color-border)',
      }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type or speak in any language..."
            rows={1}
            aria-label="Type your message"
            style={{
              flex: 1, resize: 'none', border: '1.5px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)', padding: '12px 16px',
              fontFamily: 'var(--font-body)', fontSize: 15, lineHeight: 1.5,
              outline: 'none', maxHeight: 120, background: 'var(--color-surface)',
              transition: 'border-color 0.2s',
            }}
            onFocus={(e) => (e.target.style.borderColor = 'var(--color-primary)')}
            onBlur={(e) => (e.target.style.borderColor = 'var(--color-border)')}
            onInput={(e) => {
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
            }}
          />
          <VoiceInput language={language} onTranscript={handleTranscript} onVoiceBlob={handleVoiceBlob} />
          <button
            className="btn btn-icon btn-primary"
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            aria-label="Send message"
          >
            <ArrowRight size={20} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
