import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ExternalLink, AlertTriangle } from 'lucide-react';

export function DrugProfilePage({ drug, signals, trendData }) {
  const navigate = useNavigate();
  if (!drug) return null;

  return (
    <div>
      {/* Drug header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <h1 className="text-h1" style={{ marginBottom: 4 }}>{drug.name}</h1>
            <p style={{ fontSize: 16, color: 'var(--color-text-secondary)', marginBottom: 12 }}>{drug.generic}</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ padding: '4px 12px', background: 'var(--color-primary-light)', color: 'var(--color-primary)', borderRadius: 'var(--radius-full)', fontSize: 13 }}>{drug.class}</span>
              {drug.cdsco_approved && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 12px', background: '#ECFDF5', color: '#059669', borderRadius: 'var(--radius-full)', fontSize: 13, fontWeight: 500 }}>
                  <ShieldCheck size={14} aria-hidden="true" /> CDSCO Approved
                </span>
              )}
            </div>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => navigate(`/report?drug=${encodeURIComponent(drug.name)}`)}
            aria-label={`Report a side effect for ${drug.name}`}
          >
            Report a Side Effect
          </button>
        </div>
      </div>

      {/* Drug info */}
      <div className="card" style={{ padding: 24, marginBottom: 24 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Drug Information</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <div>
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Forms</p>
            <p style={{ fontSize: 14 }}>{drug.forms?.join(', ') || 'Tablet'}</p>
          </div>
          <div>
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Brand Names</p>
            <p style={{ fontSize: 14 }}>{drug.brands?.slice(0, 3).join(', ')}</p>
          </div>
          <div>
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Therapeutic Class</p>
            <p style={{ fontSize: 14 }}>{drug.class}</p>
          </div>
        </div>
      </div>

      {/* Common ADRs */}
      <div className="card" style={{ padding: 24 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, marginBottom: 16 }}>
          Commonly Reported Side Effects
        </h2>
        {drug.common_adrs?.map((adr, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--color-primary-light)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
              {i + 1}
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 500 }}>{adr}</span>
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{Math.floor(Math.random() * 30 + 5)}%</span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: '#E5E7EB', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 3, background: 'var(--color-primary)', width: `${Math.floor(Math.random() * 60 + 20)}%`, transition: 'width 1s ease' }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
