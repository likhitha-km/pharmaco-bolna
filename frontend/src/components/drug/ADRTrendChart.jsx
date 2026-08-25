import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export function ADRTrendChart({ data = [], title = 'ADR Reports Over Time' }) {
  return (
    <div>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600, marginBottom: 16 }}>{title}</h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#9CA3AF' }} />
          <YAxis tick={{ fontSize: 12, fill: '#9CA3AF' }} />
          <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #E5E7EB', fontFamily: 'var(--font-body)' }} />
          <Line type="monotone" dataKey="reports" stroke="#169C9A" strokeWidth={2.5} dot={{ r: 4, fill: '#169C9A' }} activeDot={{ r: 6 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
