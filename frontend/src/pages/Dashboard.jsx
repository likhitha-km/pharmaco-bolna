import { useEffect, useState } from 'react';
import { FileText, Activity, Pill, Globe } from 'lucide-react';
import { PublicDashboard } from '../components/dashboard/PublicDashboard.jsx';
import { ADRHeatmap } from '../components/dashboard/ADRHeatmap.jsx';
import { dashboardApi } from '../utils/api.js';
import { Skeleton } from '../components/common/Skeleton.jsx';

const STAT_ICONS = [FileText, Activity, Pill, Globe];

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardApi.publicStats().then(({ data }) => setStats(data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const statCards = stats ? [
    { label: 'Total Reports', value: stats.total_reports?.toLocaleString('en-IN'), icon: FileText },
    { label: 'Reports This Month', value: stats.reports_this_month?.toLocaleString('en-IN'), icon: Activity },
    { label: 'Drugs with Signals', value: stats.drugs_with_signals, icon: Pill },
    { label: 'Languages', value: stats.languages_used || 9, icon: Globe },
  ] : [];

  return (
    <main className="page-content">
      <div style={{ background: 'var(--color-surface)', padding: '48px 0 32px', borderBottom: '1px solid var(--color-border)' }}>
        <div className="container">
          <h1 className="text-h1" style={{ marginBottom: 8 }}>India's Medicine Safety at a Glance</h1>
          <p className="text-body-lg">Anonymized data from voluntary patient reports across India</p>
        </div>
      </div>

      <div className="container" style={{ padding: '40px 24px' }}>
        {/* Stat cards */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 40 }}>
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} height={100} radius={14} />)}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 40 }}>
            {statCards.map(({ label, value, icon: Icon }) => (
              <div key={label} className="card" style={{ padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={20} color="var(--color-primary)" aria-hidden="true" />
                  </div>
                </div>
                <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 36, color: 'var(--color-primary)', marginBottom: 4 }}>{value}</p>
                <p style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Charts + Map */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 460px', gap: 32, alignItems: 'flex-start' }}>
          <PublicDashboard stats={stats} loading={loading} />
          <div>
            <div className="card" style={{ padding: 24 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 20, marginBottom: 20 }}>Geographic Distribution</h2>
              <ADRHeatmap geoData={stats?.geographic_distribution || []} />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
