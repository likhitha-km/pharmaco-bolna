export function TimelineViz({ events = [] }) {
  const TYPE_COLORS = {
    medicine: 'var(--color-primary)',
    reaction: '#EF4444',
    doctor: '#0EA5E9',
    stop: '#F59E0B',
    recovery: '#10B981',
    default: '#9CA3AF',
  };

  if (!events.length) {
    // Honest empty state — no fabricated placeholder dates. Real dates
    // appear here as soon as the conversation collects them.
    return (
      <div style={{ padding: '24px 0', textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
          No dated events yet — the timeline will appear once a start date or onset date is collected.
        </p>
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto', padding: '20px 0' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, minWidth: events.length * 120 }}>
        {events.map((ev, i) => {
          const color = TYPE_COLORS[ev.type] || TYPE_COLORS.default;
          return (
            <div key={i} style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {/* Label above */}
              <div style={{ textAlign: 'center', marginBottom: 8, padding: '0 4px', minHeight: 50, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <p style={{ fontSize: 12, fontFamily: 'var(--font-body)', color: 'var(--color-text-primary)', fontWeight: 500, lineHeight: 1.3 }}>{ev.label}</p>
                {ev.severity && (
                  <span style={{ fontSize: 11, color, fontWeight: 600 }}>{ev.severity}</span>
                )}
              </div>
              {/* Dot */}
              <div style={{
                width: 14, height: 14, borderRadius: '50%', background: color,
                border: '2px solid #fff', boxShadow: `0 0 0 2px ${color}`, zIndex: 1,
              }} />
              {/* Connector line */}
              {i < events.length - 1 && (
                <div style={{ position: 'absolute', top: 68, left: '50%', width: '100%', height: 2, background: '#E5E7EB', zIndex: 0 }} />
              )}
              {/* Date below */}
              <div style={{ marginTop: 8, textAlign: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>{ev.date}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
