import { SignalStats } from './SignalStats.jsx';
import { PublicDashboard } from './PublicDashboard.jsx';
import { ReportCard } from '../report/ReportCard.jsx';

export function RegulatorDashboard({ stats, signals, reports }) {
  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h2 className="text-h2" style={{ marginBottom: 8 }}>Signal Tracker</h2>
        <p className="text-body">Active pharmacovigilance signals detected from submitted reports</p>
      </div>
      <SignalStats signals={signals || []} />

      <div style={{ marginTop: 40, marginBottom: 32 }}>
        <h2 className="text-h2" style={{ marginBottom: 8 }}>Aggregate Analytics</h2>
      </div>
      <PublicDashboard stats={stats} />

      {reports?.length > 0 && (
        <div style={{ marginTop: 40 }}>
          <h2 className="text-h2" style={{ marginBottom: 20 }}>Recent Reports</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {reports.map((r) => <ReportCard key={r.id} report={r} />)}
          </div>
        </div>
      )}
    </div>
  );
}
