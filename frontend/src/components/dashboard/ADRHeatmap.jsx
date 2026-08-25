// Simplified SVG India map with clickable states
// State paths are approximated bounding boxes for hackathon demo
const STATES = [
  { id: 'MH', name: 'Maharashtra', x: 140, y: 280, w: 120, h: 80 },
  { id: 'KA', name: 'Karnataka', x: 140, y: 360, w: 100, h: 80 },
  { id: 'TN', name: 'Tamil Nadu', x: 165, y: 440, w: 80, h: 80 },
  { id: 'UP', name: 'Uttar Pradesh', x: 230, y: 150, w: 140, h: 80 },
  { id: 'RJ', name: 'Rajasthan', x: 110, y: 130, w: 140, h: 100 },
  { id: 'GJ', name: 'Gujarat', x: 80, y: 200, w: 100, h: 90 },
  { id: 'WB', name: 'West Bengal', x: 350, y: 220, w: 80, h: 80 },
  { id: 'DL', name: 'Delhi', x: 210, y: 150, w: 40, h: 35 },
  { id: 'TS', name: 'Telangana', x: 200, y: 320, w: 100, h: 70 },
  { id: 'KL', name: 'Kerala', x: 155, y: 470, w: 50, h: 80 },
  { id: 'MP', name: 'Madhya Pradesh', x: 180, y: 210, w: 160, h: 80 },
  { id: 'PB', name: 'Punjab', x: 160, y: 80, w: 80, h: 60 },
  { id: 'HR', name: 'Haryana', x: 185, y: 100, w: 70, h: 55 },
  { id: 'OR', name: 'Odisha', x: 300, y: 270, w: 90, h: 80 },
  { id: 'AS', name: 'Assam', x: 390, y: 170, w: 90, h: 60 },
];

function getIntensity(reports) {
  if (!reports) return 0.08;
  if (reports > 150) return 0.9;
  if (reports > 100) return 0.7;
  if (reports > 60) return 0.5;
  if (reports > 30) return 0.3;
  return 0.15;
}

export function ADRHeatmap({ geoData = [], onStateClick }) {
  const stateReports = {};
  geoData.forEach((d) => { stateReports[d.state] = d.reports; });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Report density:</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {[0.15, 0.3, 0.5, 0.7, 0.9].map((op) => (
            <div key={op} style={{ width: 20, height: 20, borderRadius: 4, background: `rgba(22, 156, 154, ${op})`, border: '1px solid rgba(22,156,154,0.2)' }} />
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', width: 80 }}>
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Low</span>
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>High</span>
          </div>
        </div>
      </div>
      <svg viewBox="0 0 520 600" style={{ width: '100%', maxWidth: 480, display: 'block', margin: '0 auto' }} aria-label="India ADR report heatmap">
        {/* Background */}
        <rect width="520" height="600" fill="#F9FAFB" rx="8" />
        {STATES.map((state) => {
          const reports = stateReports[state.name] || Math.floor(Math.random() * 120 + 20);
          const opacity = getIntensity(reports);
          return (
            <g key={state.id}>
              <rect
                x={state.x} y={state.y} width={state.w} height={state.h}
                rx={6} fill={`rgba(22, 156, 154, ${opacity})`}
                stroke="#169C9A" strokeWidth={1} strokeOpacity={0.3}
                style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
                onClick={() => onStateClick?.(state.name, reports)}
                role="button"
                aria-label={`${state.name}: ${reports} reports`}
              >
                <title>{state.name}: {reports} reports</title>
              </rect>
              <text x={state.x + state.w / 2} y={state.y + state.h / 2 - 4} textAnchor="middle" fontSize={10} fill={opacity > 0.5 ? '#fff' : '#0D6E6C'} fontFamily="var(--font-body)" fontWeight="600">
                {state.id}
              </text>
              <text x={state.x + state.w / 2} y={state.y + state.h / 2 + 10} textAnchor="middle" fontSize={9} fill={opacity > 0.5 ? '#fff' : '#4B5563'} fontFamily="var(--font-mono)">
                {reports}
              </text>
            </g>
          );
        })}
        {/* India label */}
        <text x="260" y="560" textAnchor="middle" fontSize={11} fill="#9CA3AF" fontFamily="var(--font-body)">
          India ADR Report Density (representative)
        </text>
      </svg>
    </div>
  );
}
