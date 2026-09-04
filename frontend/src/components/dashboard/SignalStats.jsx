import { TrendingUp, AlertCircle, Activity } from 'lucide-react';

export function SignalStats({ signals = [] }) {
  const serious = signals.filter((s) => s.strength === 'Strong');
  const moderate = signals.filter((s) => s.strength === 'Moderate');
  const weak = signals.filter((s) => s.strength === 'Weak');

  return (
    <div>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Strong Signals', count: serious.length, color: '#DC2626', bg: '#FEF2F2', icon: AlertCircle },
          { label: 'Moderate Signals', count: moderate.length, color: '#D97706', bg: '#FEF3C7', icon: Activity },
          { label: 'Weak Signals', count: weak.length, color: '#169C9A', bg: '#E6F7F7', icon: TrendingUp },
        ].map(({ label, count, color, bg, icon: Icon }) => (
          <div key={label} style={{ padding: 16, background: bg, borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
            <Icon size={24} color={color} style={{ margin: '0 auto 8px' }} aria-hidden="true" />
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color }}>{count}</p>
            <p style={{ fontSize: 12, color }}>{label}</p>
          </div>
        ))}
      </div>

      {signals.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', padding: '16px 0', textAlign: 'center' }}>
          No active signals yet — a drug/reaction pair appears here once it has been reported at least 3 times.
        </p>
      )}

      {/* Signal table */}
      {signals.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                {['Drug', 'Adverse Reaction', 'Count', 'Strength', 'Action'].map((h) => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontFamily: 'var(--font-body)', fontWeight: 600, color: 'var(--color-text-secondary)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {signals.map((s, i) => {
                const strengthColor = { Strong: '#DC2626', Moderate: '#D97706', Weak: '#169C9A' }[s.strength] || '#6B7280';
                return (
                  <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-surface-secondary)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '12px 12px', fontWeight: 600 }}>{s.drug}</td>
                    <td style={{ padding: '12px 12px', color: 'var(--color-text-secondary)' }}>{s.adr}</td>
                    <td style={{ padding: '12px 12px', fontFamily: 'var(--font-mono)', color: 'var(--color-primary)' }}>{s.count}</td>
                    <td style={{ padding: '12px 12px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 'var(--radius-full)', background: strengthColor + '15', color: strengthColor, fontWeight: 600, fontSize: 12 }}>
                        {s.strength}
                      </span>
                    </td>
                    <td style={{ padding: '12px 12px', color: 'var(--color-text-secondary)', fontSize: 12 }}>{s.recommended_action}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
