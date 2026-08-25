import { useState, useEffect } from 'react';
import { SafetyTimeline } from '../components/drug/SafetyTimeline.jsx';
import { drugApi } from '../utils/api.js';
import { ShieldAlert, Ban, HelpCircle, BookOpen, ExternalLink } from 'lucide-react';

const TABS = [
  { id: 'alerts', label: 'Safety Alerts', icon: ShieldAlert },
  { id: 'banned', label: 'Banned Medicines', icon: Ban },
  { id: 'myths', label: 'Myth vs Fact', icon: HelpCircle },
  { id: 'pvpi', label: 'About PvPI', icon: BookOpen },
];

const MYTHS = [
  { myth: 'Reporting a side effect means my doctor was wrong.', fact: 'Adverse drug reactions can happen to anyone. Reporting them helps improve medicines for everyone, not blame anyone.' },
  { myth: 'Only serious side effects need to be reported.', fact: 'All side effects, even mild ones, are valuable. Patterns from many mild reports can reveal important safety signals.' },
  { myth: 'My report won\'t make a difference.', fact: 'Every report contributes to India\'s national safety database. Historical drug recalls have been triggered by patient reports.' },
  { myth: 'Reporting is complicated and requires medical knowledge.', fact: 'Pharmaco makes it as simple as a conversation. Just describe what happened in your own language.' },
];

export default function SafetyHub() {
  const [activeTab, setActiveTab] = useState('alerts');
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    drugApi.safetyAlerts().then(({ data }) => setAlerts(data.alerts || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const bannedAlerts = alerts.filter((a) => ['Ban', 'Market Withdrawal'].includes(a.alert_type));

  return (
    <main className="page-content">
      <div style={{ background: 'var(--color-surface)', padding: '48px 0 0', borderBottom: '1px solid var(--color-border)' }}>
        <div className="container">
          <h1 className="text-h1" style={{ marginBottom: 8 }}>Drug Safety Hub</h1>
          <p className="text-body-lg" style={{ marginBottom: 32 }}>Curated safety information from CDSCO, PvPI, and WHO</p>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0 }}>
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px',
                  borderBottom: `2px solid ${activeTab === id ? 'var(--color-primary)' : 'transparent'}`,
                  color: activeTab === id ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                  fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 500,
                  background: 'none', border: 'none', cursor: 'pointer',
                }}
                role="tab" aria-selected={activeTab === id}
              >
                <Icon size={16} aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="container" style={{ padding: '40px 24px', maxWidth: 900 }}>
        {/* Safety Alerts */}
        {activeTab === 'alerts' && (
          <div>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 24 }}>
              Showing {alerts.length} safety communications from CDSCO and PvPI (historical, publicly available data)
            </p>
            <SafetyTimeline events={loading ? [] : alerts} />
          </div>
        )}

        {/* Banned */}
        {activeTab === 'banned' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 8 }}>Medicines banned or withdrawn from Indian markets</p>
            {bannedAlerts.map((alert) => (
              <div key={alert.id} className="card" style={{ padding: 20, borderLeft: '4px solid #EF4444' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                  <Ban size={20} color="#DC2626" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
                  <div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 16 }}>{alert.drug}</span>
                      <span style={{ padding: '2px 8px', background: '#FEF2F2', color: '#DC2626', borderRadius: 'var(--radius-full)', fontSize: 11, fontWeight: 600 }}>{alert.alert_type}</span>
                      <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{alert.date}</span>
                    </div>
                    <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>{alert.summary}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Myths */}
        {activeTab === 'myths' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {MYTHS.map(({ myth, fact }, i) => (
              <div key={i} className="card" style={{ padding: 24 }}>
                <div style={{ marginBottom: 12, display: 'flex', gap: 10 }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 12, color: '#DC2626', fontWeight: 700 }}>M</span>
                  </div>
                  <p style={{ fontSize: 15, fontStyle: 'italic', color: 'var(--color-text-secondary)' }}>"{myth}"</p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 12, color: '#059669', fontWeight: 700 }}>F</span>
                  </div>
                  <p style={{ fontSize: 15, color: 'var(--color-text-primary)', lineHeight: 1.6 }}>{fact}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* About PvPI */}
        {activeTab === 'pvpi' && (
          <div>
            <div className="card" style={{ padding: 32 }}>
              <h2 className="text-h3" style={{ marginBottom: 16 }}>About India's Pharmacovigilance Programme (PvPI)</h2>
              <p style={{ fontSize: 15, lineHeight: 1.8, color: 'var(--color-text-secondary)', marginBottom: 16 }}>
                The Pharmacovigilance Programme of India (PvPI) was launched by the Central Drugs Standard Control Organisation (CDSCO) in 2010 to monitor the safety of medicines in India. It is coordinated by the Indian Pharmacopoeia Commission (IPC) in Ghaziabad.
              </p>
              <p style={{ fontSize: 15, lineHeight: 1.8, color: 'var(--color-text-secondary)', marginBottom: 24 }}>
                PvPI collects Individual Case Safety Reports (ICSRs) from healthcare professionals, patients, and caregivers across India's 250+ Adverse Drug Reaction Monitoring Centres (AMCs). Pharmaco is designed to make this reporting more accessible to all Indians.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {[
                  { href: 'https://pvpi.nic.in', label: 'PvPI Official Portal', desc: 'India\'s national pharmacovigilance programme' },
                  { href: 'https://cdsco.gov.in', label: 'CDSCO', desc: 'Central Drugs Standard Control Organisation' },
                  { href: 'https://ipc.nic.in', label: 'Indian Pharmacopoeia Commission', desc: 'PvPI National Coordination Centre' },
                  { href: 'https://who-umc.org', label: 'WHO-UMC', desc: 'WHO Uppsala Monitoring Centre' },
                ].map(({ href, label, desc }) => (
                  <a key={href} href={href} target="_blank" rel="noopener noreferrer" className="card"
                    style={{ padding: 16, display: 'block', textDecoration: 'none' }}
                    onMouseEnter={(e) => (e.currentTarget.style.boxShadow = 'var(--shadow-lg)')}
                    onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'var(--shadow-md)')}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-primary)', marginBottom: 4 }}>{label}</p>
                        <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{desc}</p>
                      </div>
                      <ExternalLink size={14} color="var(--color-text-muted)" aria-hidden="true" />
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
