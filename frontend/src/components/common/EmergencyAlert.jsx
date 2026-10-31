import { motion } from 'framer-motion';
import { AlertTriangle, Phone } from 'lucide-react';
import { tSafety } from '../../utils/i18n.js';

export function EmergencyAlert({ onContinue, language = 'en-IN' }) {
  const t = (key) => tSafety(key, language);
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: '#FEF2F2',
        border: '2px solid #EF4444',
        borderRadius: 'var(--radius-lg)',
        padding: '20px 24px',
        margin: '12px 0',
      }}
      role="alert"
      aria-live="assertive"
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
        <AlertTriangle size={32} color="#DC2626" style={{ flexShrink: 0 }} aria-hidden="true" />
        <div style={{ flex: 1 }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 20, color: '#DC2626', marginBottom: 8 }}>
            {t('emergencyHeading')}
          </h3>
          <p style={{ fontSize: 15, color: '#7F1D1D', marginBottom: 16 }}>
            {t('emergencyText')}
          </p>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
            <a
              href="tel:112"
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px',
                background: '#DC2626', color: '#fff', borderRadius: 'var(--radius-md)',
                fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 15,
              }}
              aria-label={t('nationalEmergency')}
            >
              <Phone size={18} aria-hidden="true" />
              {t('nationalEmergency')}
            </a>
            <a
              href="tel:108"
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px',
                background: '#fff', color: '#DC2626', border: '1.5px solid #DC2626', borderRadius: 'var(--radius-md)',
                fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 15,
              }}
              aria-label={t('ambulance')}
            >
              <Phone size={18} aria-hidden="true" />
              {t('ambulance')}
            </a>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: '#FCA5A5', borderRadius: 'var(--radius-md)', color: '#7F1D1D', fontSize: 14 }}>
              <Phone size={16} aria-hidden="true" />
              {t('helpline')}
            </div>
          </div>
          {onContinue && (
            <button
              className="btn btn-ghost"
              onClick={onContinue}
              style={{ color: '#DC2626', fontSize: 14 }}
              aria-label={t('continueReporting')}
            >
              {t('continueReporting')}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
