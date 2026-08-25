import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { Skeleton } from '../common/Skeleton.jsx';

const TEAL_SHADES = ['#169C9A', '#1BBDBA', '#3ED4D2', '#6DE0DE', '#9EEBEA', '#C7F4F4'];

export function PublicDashboard({ stats, loading }) {
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {[1, 2, 3].map((i) => <Skeleton key={i} height={200} radius={14} />)}
      </div>
    );
  }

  if (!stats) return null;

  const pieData = [
    { name: 'Non-serious', value: stats.serious_vs_nonserious?.non_serious || 82 },
    { name: 'Serious', value: stats.serious_vs_nonserious?.serious || 18 },
  ];

  const reporterData = Object.entries(stats.reporter_type_distribution || {}).map(([name, value]) => ({
    name: name.replace(/_/g, ' '), value,
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {/* Monthly Trend */}
      <div className="card" style={{ padding: 24 }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 18, marginBottom: 20 }}>Monthly Report Volume</h3>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={stats.monthly_trend || []}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#9CA3AF' }} />
            <YAxis tick={{ fontSize: 12, fill: '#9CA3AF' }} />
            <Tooltip contentStyle={{ borderRadius: 10, fontFamily: 'var(--font-body)' }} />
            <Line type="monotone" dataKey="reports" stroke="#169C9A" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Top drugs + serious/non-serious side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24 }}>
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 18, marginBottom: 20 }}>Top 10 Drugs by Report Count</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={stats.top_drugs || []} layout="vertical" barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 12, fill: '#9CA3AF' }} />
              <YAxis type="category" dataKey="drug" tick={{ fontSize: 12, fill: '#4B5563' }} width={100} />
              <Tooltip contentStyle={{ borderRadius: 10, fontFamily: 'var(--font-body)' }} />
              <Bar dataKey="reports" fill="#169C9A" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 18, marginBottom: 20 }}>Seriousness</h3>
          <PieChart width={240} height={200}>
            <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
              <Cell fill="#EF4444" />
              <Cell fill="#169C9A" />
            </Pie>
            <Tooltip contentStyle={{ borderRadius: 10, fontFamily: 'var(--font-body)' }} />
            <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </div>
      </div>

      {/* Top ADRs */}
      <div className="card" style={{ padding: 24 }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 18, marginBottom: 20 }}>Top 10 Adverse Reactions</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={stats.common_adrs || []} barSize={20}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey="term" tick={{ fontSize: 11, fill: '#9CA3AF' }} />
            <YAxis tick={{ fontSize: 12, fill: '#9CA3AF' }} />
            <Tooltip contentStyle={{ borderRadius: 10, fontFamily: 'var(--font-body)' }} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {(stats.common_adrs || []).map((_, i) => (
                <Cell key={i} fill={TEAL_SHADES[i % TEAL_SHADES.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Reporter distribution */}
      <div className="card" style={{ padding: 24 }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 18, marginBottom: 20 }}>Reporter Distribution</h3>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <PieChart width={400} height={220}>
            <Pie data={reporterData} cx="50%" cy="50%" innerRadius={60} outerRadius={95} paddingAngle={3} dataKey="value">
              {reporterData.map((_, i) => <Cell key={i} fill={TEAL_SHADES[i]} />)}
            </Pie>
            <Tooltip contentStyle={{ borderRadius: 10, fontFamily: 'var(--font-body)' }} />
            <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </div>
      </div>
    </div>
  );
}
