import { CheckCircle, Circle, ChevronRight } from 'lucide-react';

export function ReportCard({ report, onClick }) {
  const statusColors = {
    draft: { bg: '#F3F4F6', color: '#6B7280', label: 'Draft' },
    submitted: { bg: '#EFF6FF', color: '#2563EB', label: 'Submitted' },
    under_review: { bg: '#FEF3C7', color: '#D97706', label: 'Under Review' },
    followup_requested: { bg: '#FEF3C7', color: '#D97706', label: 'Follow-up Requested' },
    closed: { bg: '#ECFDF5', color: '#059669', label: 'Closed' },
    withdrawn: { bg: '#F3F4F6', color: '#6B7280', label: 'Withdrawn' },
  };

  const status = statusColors[report.status] || statusColors.submitted;
  const icsr = report.icsr || {};
  const med = icsr.suspect_drugs?.[0] || report.extractedData?.suspected_medicines?.[0];
  const adr = icsr.adverse_events?.[0] || report.extractedData?.adverse_reactions?.[0];
  const score = report.completenessScore || icsr.completeness_score || 0;

  return (
    <div
      className="card card-hover"
      onClick={onClick}
      style={{ padding: '20px 24px', cursor: 'pointer' }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
      aria-label={`View report for ${med?.name || 'Unknown drug'}`}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-primary)', background: 'var(--color-primary-light)', padding: '3px 8px', borderRadius: 4 }}>
              {report.id || report.reportId || 'PVP-DRAFT'}
            </span>
            <span style={{ padding: '3px 10px', borderRadius: 'var(--radius-full)', background: status.bg, color: status.color, fontSize: 12, fontWeight: 500 }}>
              {status.label}
            </span>
          </div>
          <div style={{ marginBottom: 6 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 17, color: 'var(--color-text-primary)' }}>
              {med?.name || 'Unknown Drug'}
            </span>
            {adr && (
              <span style={{ marginLeft: 8, fontSize: 14, color: 'var(--color-text-secondary)' }}>
                — {adr.meddra_preferred_term || adr.english_translation || adr.original_text}
              </span>
            )}
          </div>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
            Submitted {report.createdAt ? new Date(report.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'recently'}
          </p>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 24, fontFamily: 'var(--font-display)', fontWeight: 700, color: score >= 70 ? 'var(--color-success)' : score >= 50 ? 'var(--color-warning)' : 'var(--color-error)' }}>
            {score}%
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Complete</div>
          <ChevronRight size={18} color="var(--color-text-muted)" style={{ marginTop: 8 }} aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
