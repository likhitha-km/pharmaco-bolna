import { useEffect, useState } from 'react';
import { dashboardApi } from '../utils/api.js';
import { RegulatorDashboard as RegulatorDashboardComponent } from '../components/dashboard/RegulatorDashboard.jsx';
import { Skeleton } from '../components/common/Skeleton.jsx';

export default function RegulatorDashboard() {
  const [stats, setStats] = useState(null);
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      dashboardApi.publicStats(),
      dashboardApi.signalTracker(),
    ]).then(([statsRes, signalsRes]) => {
      setStats(statsRes.data);
      setSignals(signalsRes.data?.signals || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <main className="page-content">
      <div style={{ background: 'var(--color-surface)', padding: '48px 0 32px', borderBottom: '1px solid var(--color-border)' }}>
        <div className="container">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ padding: '4px 12px', background: '#FEF3C7', color: '#D97706', borderRadius: 'var(--radius-full)', fontSize: 12, fontWeight: 600 }}>
              Regulator Access
            </div>
          </div>
          <h1 className="text-h1" style={{ marginTop: 12, marginBottom: 8 }}>Pharmacovigilance Dashboard</h1>
          <p className="text-body-lg">Real-time signal detection and ICSR management for CDSCO/PvPI</p>
        </div>
      </div>

      <div className="container" style={{ padding: '40px 24px' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {[1, 2, 3].map((i) => <Skeleton key={i} height={200} radius={14} />)}
          </div>
        ) : (
          <RegulatorDashboardComponent stats={stats} signals={signals} />
        )}
      </div>
    </main>
  );
}
