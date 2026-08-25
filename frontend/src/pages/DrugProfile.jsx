import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DrugProfilePage } from '../components/drug/DrugProfilePage.jsx';
import { ADRTrendChart } from '../components/drug/ADRTrendChart.jsx';
import { SafetyTimeline } from '../components/drug/SafetyTimeline.jsx';
import { Skeleton } from '../components/common/Skeleton.jsx';
import { drugApi } from '../utils/api.js';
import { ArrowLeft } from 'lucide-react';

const TABS = ['Overview', 'Side Effects', 'Safety History'];

export default function DrugProfile() {
  const { drugName } = useParams();
  const navigate = useNavigate();
  const [drug, setDrug] = useState(null);
  const [trendData, setTrendData] = useState([]);
  const [safetyAlerts, setSafetyAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Overview');

  useEffect(() => {
    drugApi.profile(drugName).then(({ data }) => {
      setDrug(data.drug);
      setTrendData(data.trendData || []);
      setSafetyAlerts(data.safetyAlerts || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [drugName]);

  if (loading) {
    return (
      <main className="page-content">
        <div className="container" style={{ maxWidth: 1000, padding: '40px 24px' }}>
          <Skeleton height={40} radius={10} style={{ marginBottom: 16 }} />
          <Skeleton height={200} radius={14} />
        </div>
      </main>
    );
  }

  if (!drug) {
    return (
      <main className="page-content">
        <div className="container" style={{ textAlign: 'center', padding: '80px 24px' }}>
          <p className="text-h3">Drug not found</p>
          <button className="btn btn-outline" onClick={() => navigate('/search')} style={{ marginTop: 16 }}>Back to Search</button>
        </div>
      </main>
    );
  }

  return (
    <main className="page-content">
      <div className="container" style={{ maxWidth: 1000, padding: '40px 24px' }}>
        <button className="btn btn-ghost" onClick={() => navigate(-1)} style={{ marginBottom: 24 }} aria-label="Go back">
          <ArrowLeft size={18} aria-hidden="true" /> Back
        </button>

        <DrugProfilePage drug={drug} />

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--color-border)', marginTop: 32, marginBottom: 32 }}>
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '12px 20px', fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14,
                color: activeTab === tab ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                borderBottom: `2px solid ${activeTab === tab ? 'var(--color-primary)' : 'transparent'}`,
                marginBottom: -2, cursor: 'pointer', background: 'none', border: 'none', transition: 'all 0.2s',
              }}
              aria-selected={activeTab === tab}
              role="tab"
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === 'Overview' && (
          <div className="card" style={{ padding: 24 }}>
            <ADRTrendChart data={trendData} />
          </div>
        )}

        {activeTab === 'Side Effects' && (
          <div className="card" style={{ padding: 24 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, marginBottom: 20 }}>Known Side Effects</h2>
            {drug.common_adrs?.map((adr, i) => (
              <div key={i} style={{ padding: '12px 0', borderBottom: '1px solid var(--color-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontWeight: 500, fontSize: 15 }}>{adr}</span>
                  <span style={{ fontSize: 12, padding: '2px 10px', background: 'var(--color-primary-light)', color: 'var(--color-primary)', borderRadius: 'var(--radius-full)' }}>
                    MedDRA coded
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'Safety History' && (
          <div className="card" style={{ padding: 24 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, marginBottom: 24 }}>Safety Timeline</h2>
            <SafetyTimeline events={safetyAlerts} />
          </div>
        )}
      </div>
    </main>
  );
}
