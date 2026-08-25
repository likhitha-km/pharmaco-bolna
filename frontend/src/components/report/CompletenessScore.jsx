import { useMemo } from 'react';

export function CompletenessScore({ score = 0, fields = [] }) {
  const grade = score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 50 ? 'C' : 'D';
  const gradeColor = { A: '#10B981', B: '#0EA5E9', C: '#F59E0B', D: '#EF4444' }[grade];

  const circumference = 2 * Math.PI * 38;
  const offset = circumference - (score / 100) * circumference;

  const missing = fields.filter((f) => !f.filled).map((f) => f.label);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div title={missing.length ? `Missing: ${missing.join(', ')}` : 'All required fields complete'} style={{ position: 'relative', cursor: 'help' }}>
        <svg width={96} height={96} viewBox="0 0 96 96" aria-label={`Report completeness: ${score}%`}>
          {/* Background circle */}
          <circle cx={48} cy={48} r={38} fill="none" stroke="#E5E7EB" strokeWidth={8} />
          {/* Progress circle */}
          <circle
            cx={48} cy={48} r={38} fill="none"
            stroke={gradeColor} strokeWidth={8}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform="rotate(-90 48 48)"
            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, color: gradeColor }}>
            {score}%
          </span>
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <span style={{
          padding: '4px 14px', borderRadius: 'var(--radius-full)',
          background: gradeColor + '20', color: gradeColor,
          fontWeight: 600, fontSize: 14, fontFamily: 'var(--font-display)',
        }}>
          Grade {grade}
        </span>
        {missing.length > 0 && (
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 6, textAlign: 'center' }}>
            {missing.length} field{missing.length !== 1 ? 's' : ''} missing
          </p>
        )}
      </div>
    </div>
  );
}
