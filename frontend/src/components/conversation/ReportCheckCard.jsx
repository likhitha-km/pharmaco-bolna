import { motion } from 'framer-motion';
import { ClipboardCheck, Pencil, MessageSquarePlus, Save, Volume2, Sparkles, Quote, CheckCircle2 } from 'lucide-react';

const DECHALLENGE = {
  positive: 'Got better after the medicine was stopped or reduced',
  negative: 'Did not get better after stopping',
};

function Tag({ kind }) {
  const styles = {
    yours: { label: 'Your words', bg: '#ECFDF5', fg: '#047857', icon: Quote },
    ai: { label: 'AI-interpreted', bg: '#F5F3FF', fg: '#6D28D9', icon: Sparkles },
    match: { label: 'Pharmaco match', bg: 'var(--color-primary-light)', fg: 'var(--color-primary-dark)', icon: CheckCircle2 },
  }[kind];
  const Icon = styles.icon;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 7px', borderRadius: 999, background: styles.bg, color: styles.fg, fontSize: 10.5, fontWeight: 700, whiteSpace: 'nowrap' }}>
      <Icon size={10} aria-hidden="true" /> {styles.label}
    </span>
  );
}

function Row({ label, children }) {
  return (
    <div className="report-check-row">
      <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 14, color: 'var(--color-text-primary)', display: 'flex', flexDirection: 'column', gap: 3 }}>{children}</div>
    </div>
  );
}

/**
 * Read-back shown in the chat once the assistant has enough for a report.
 * Everything here was extracted by AI from the user's messages, so the card
 * marks what is the user's own wording vs. what Pharmaco interpreted, and
 * nothing is filed until the user confirms on the review screen.
 */
export function ReportCheckCard({
  extractedData, missingLabels = [], onConfirm, onCorrect, onAddMissing, onSaveLater, onReadAloud, canReadAloud, onStartNew, saving,
}) {
  const x = extractedData || {};
  const med = x.suspected_medicines?.[0] || {};
  const rxn = x.adverse_reactions?.[0] || {};
  const patient = x.patient || {};
  const clinical = x.clinical_context || {};
  const dechallenge = DECHALLENGE[x.causality_signals?.dechallenge];
  const matched = med.name_source === 'formulary_match' && med.spoken_name && med.spoken_name.toLowerCase() !== med.name?.toLowerCase();
  const translated = rxn.english_translation && rxn.original_text && rxn.english_translation.trim().toLowerCase() !== rxn.original_text.trim().toLowerCase();
  const patientText = [patient.age_group, patient.gender].filter(Boolean).join(', ');
  const otherMeds = (clinical.concomitant_medications || []).join(', ');

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="report-check-card"
      aria-label="Check your report before submitting"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <ClipboardCheck size={20} color="var(--color-primary)" aria-hidden="true" />
        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 17 }}>Please check your report</h3>
      </div>
      <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 12 }}>
        Pharmaco used AI to pick out these details from what you said. Check them carefully. Nothing is submitted until you confirm.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <Row label="Medicine">
          <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
            <strong>{med.name || '—'}</strong>
            {matched && <Tag kind="match" />}
          </span>
          {matched && <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>You said “{med.spoken_name}”. Pharmaco matched it to its generic name.</span>}
          {(med.dosage || med.frequency) && <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{[med.dosage, med.frequency].filter(Boolean).join(', ')}</span>}
        </Row>
        <Row label="What happened">
          {rxn.original_text ? (
            <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>“{rxn.original_text}” <Tag kind="yours" /></span>
          ) : '—'}
          {translated && (
            <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--color-text-secondary)' }}>{rxn.english_translation} <Tag kind="ai" /></span>
          )}
        </Row>
        {rxn.onset_date && <Row label="When it started">{rxn.onset_date}</Row>}
        {dechallenge && <Row label="After stopping">{dechallenge}</Row>}
        {clinical.outcome && <Row label="How things are now">{clinical.outcome}</Row>}
        {patientText && <Row label="Patient">{patientText}</Row>}
        {otherMeds && <Row label="Other medicines">{otherMeds}</Row>}
      </div>

      {missingLabels.length > 0 && (
        <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 'var(--radius-md)', background: '#FFFBEB', border: '1px solid #FDE68A' }}>
          <div style={{ fontSize: 13, color: '#92400E', fontWeight: 600, marginBottom: 2 }}>A few details would make your report stronger</div>
          <div style={{ fontSize: 12.5, color: '#92400E' }}>{missingLabels.join(' · ')}. These are optional. You can answer now, or save and come back later.</div>
        </div>
      )}

      <div className="report-check-actions">
        <button className="btn btn-primary btn-sm" onClick={onConfirm}>
          <CheckCircle2 size={15} aria-hidden="true" /> Yes, this is right: review &amp; submit
        </button>
        <button className="btn btn-outline btn-sm" onClick={onCorrect}>
          <Pencil size={14} aria-hidden="true" /> Something’s wrong
        </button>
        {missingLabels.length > 0 && (
          <button className="btn btn-outline btn-sm" onClick={onAddMissing}>
            <MessageSquarePlus size={14} aria-hidden="true" /> Answer missing questions
          </button>
        )}
        <button className="btn btn-ghost btn-sm" onClick={onSaveLater} disabled={saving}>
          <Save size={14} aria-hidden="true" /> {saving ? 'Saving…' : 'Save & finish later'}
        </button>
        {canReadAloud && (
          <button className="btn btn-ghost btn-sm" onClick={onReadAloud}>
            <Volume2 size={14} aria-hidden="true" /> Listen to summary
          </button>
        )}
      </div>
      {onStartNew && (
        <button onClick={onStartNew} style={{ marginTop: 8, background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
          Start a new report instead
        </button>
      )}
    </motion.section>
  );
}
