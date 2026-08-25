import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

const ICONS = { success: CheckCircle, error: AlertCircle, warning: AlertCircle, info: Info };
const COLORS = {
  success: { bg: '#ECFDF5', border: '#10B981', icon: '#059669' },
  error: { bg: '#FEF2F2', border: '#EF4444', icon: '#DC2626' },
  warning: { bg: '#FEF3C7', border: '#F59E0B', icon: '#D97706' },
  info: { bg: '#EFF6FF', border: '#0EA5E9', icon: '#0284C7' },
};

export function Toast({ message, type = 'info', onClose, duration = 4000 }) {
  useEffect(() => {
    if (duration) {
      const t = setTimeout(onClose, duration);
      return () => clearTimeout(t);
    }
  }, [duration, onClose]);

  const Icon = ICONS[type];
  const colors = COLORS[type];

  return (
    <motion.div
      initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 60 }}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px',
        background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-lg)', maxWidth: 380, width: '100%', position: 'relative',
      }}
      role="alert"
    >
      <Icon size={18} color={colors.icon} style={{ flexShrink: 0, marginTop: 1 }} />
      <p style={{ fontSize: 14, fontFamily: 'var(--font-body)', color: 'var(--color-text-primary)', flex: 1 }}>{message}</p>
      <button onClick={onClose} style={{ color: colors.icon, flexShrink: 0 }} aria-label="Dismiss notification">
        <X size={16} />
      </button>
    </motion.div>
  );
}

// Toast container — manages a queue of toasts
let _addToast = null;
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  _addToast = (toast) => setToasts((p) => [...p, { ...toast, id: Date.now() }]);

  return (
    <>
      {children}
      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <AnimatePresence>
          {toasts.map((t) => (
            <Toast key={t.id} {...t} onClose={() => setToasts((p) => p.filter((x) => x.id !== t.id))} />
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}

export function showToast(message, type = 'info') {
  _addToast?.({ message, type });
}
