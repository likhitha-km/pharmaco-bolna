export function ConfidenceScore({ confidence }) {
  if (confidence == null) return null;
  const pct = Math.round(confidence * 100);
  let variant, label;
  if (pct >= 90) { variant = 'success'; label = 'High confidence'; }
  else if (pct >= 70) { variant = 'warning'; label = 'Review suggested'; }
  else { variant = 'error'; label = 'Please verify'; }

  const colors = { success: { bg: '#ECFDF5', color: '#059669' }, warning: { bg: '#FEF3C7', color: '#D97706' }, error: { bg: '#FEF2F2', color: '#DC2626' } }[variant];

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px',
      borderRadius: 'var(--radius-full)', background: colors.bg, color: colors.color,
      fontSize: 11, fontWeight: 500, fontFamily: 'var(--font-body)',
    }}>
      {pct}% — {label}
    </span>
  );
}
