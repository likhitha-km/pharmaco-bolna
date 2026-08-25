import { motion } from 'framer-motion';
import { Shield, Mic } from 'lucide-react';
import clsx from 'clsx';

export function ChatBubble({ message, role, timestamp, isLoading }) {
  const isBot = role === 'assistant';

  if (isBot) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
        style={{ display: 'flex', gap: 10, alignItems: 'flex-start', maxWidth: '78%' }}
        aria-live="polite"
      >
        {/* Avatar */}
        <div style={{
          width: 36, height: 36, borderRadius: '50%', background: 'var(--color-primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2,
        }}>
          <Shield size={18} color="#fff" aria-hidden="true" />
        </div>
        <div>
          <div style={{
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: '0 var(--radius-lg) var(--radius-lg) var(--radius-lg)',
            padding: '12px 16px', boxShadow: 'var(--shadow-sm)',
          }}>
            {isLoading ? (
              <TypingDots />
            ) : (
              <p style={{ fontSize: 15, fontFamily: 'var(--font-body)', color: 'var(--color-text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {message}
              </p>
            )}
          </div>
          {timestamp && !isLoading && (
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4, display: 'block', paddingLeft: 4 }}>
              {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </motion.div>
    );
  }

  // User bubble
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
      style={{ display: 'flex', justifyContent: 'flex-end', maxWidth: '78%', alignSelf: 'flex-end' }}
    >
      <div>
        <div style={{
          background: 'var(--color-primary)', color: '#fff',
          borderRadius: 'var(--radius-lg) 0 var(--radius-lg) var(--radius-lg)',
          padding: '12px 16px', maxWidth: '100%',
        }}>
          <p style={{ fontSize: 15, fontFamily: 'var(--font-body)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{message}</p>
        </div>
        {timestamp && (
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4, display: 'block', textAlign: 'right', paddingRight: 4 }}>
            {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
    </motion.div>
  );
}

function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: 5, padding: '2px 0', alignItems: 'center' }} aria-label="Assistant is typing">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            width: 8, height: 8, borderRadius: '50%', background: 'var(--color-primary)',
            animation: `dotBounce 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </div>
  );
}
