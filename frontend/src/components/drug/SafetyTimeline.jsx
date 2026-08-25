export function SafetyTimeline({ events = [] }) {
  const TYPE_STYLES = {
    'CDSCO Alert': { color: '#DC2626', bg: '#FEF2F2' },
    'Label Update': { color: '#D97706', bg: '#FEF3C7' },
    'Drug Recall': { color: '#DC2626', bg: '#FEF2F2' },
    'PvPI Signal': { color: '#169C9A', bg: '#E6F7F7' },
    'Market Withdrawal': { color: '#7C3AED', bg: '#EDE9FE' },
    'Ban': { color: '#DC2626', bg: '#FEF2F2' },
  };

  if (!events.length) {
    return <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>No safety events recorded for this medicine.</p>;
  }

  return (
    <div style={{ position: 'relative', paddingLeft: 32 }}>
      {/* Vertical line */}
      <div style={{ position: 'absolute', left: 8, top: 0, bottom: 0, width: 2, background: '#E5E7EB' }} />
      {events.map((ev, i) => {
        const styles = TYPE_STYLES[ev.alert_type] || { color: '#6B7280', bg: '#F3F4F6' };
        return (
          <div key={i} style={{ position: 'relative', marginBottom: 28 }}>
            {/* Dot */}
            <div style={{
              position: 'absolute', left: -28, top: 4, width: 12, height: 12,
              borderRadius: '50%', background: styles.color, border: '2px solid #fff',
              boxShadow: `0 0 0 2px ${styles.color}`,
            }} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>{ev.date}</span>
                <span style={{ padding: '2px 8px', borderRadius: 'var(--radius-full)', background: styles.bg, color: styles.color, fontSize: 11, fontWeight: 500 }}>
                  {ev.alert_type}
                </span>
              </div>
              <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text-primary)', marginBottom: 4 }}>{ev.drug}</p>
              <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>{ev.summary}</p>
              {ev.action_required && (
                <p style={{ fontSize: 12, color: '#D97706', marginTop: 6 }}>Action: {ev.action_required}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
