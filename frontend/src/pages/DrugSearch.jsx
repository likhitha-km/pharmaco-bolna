import { useNavigate } from 'react-router-dom';
import { DrugSearchBar } from '../components/drug/DrugSearchBar.jsx';
import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';

export default function DrugSearch() {
  const navigate = useNavigate();
  const [results, setResults] = useState([]);

  const handleSelect = (drug) => navigate(`/drug/${encodeURIComponent(drug.name)}`);

  return (
    <main className="page-content">
      <div style={{ background: 'var(--color-surface)', padding: '60px 0 40px', borderBottom: '1px solid var(--color-border)' }}>
        <div className="container" style={{ maxWidth: 800 }}>
          <h1 className="text-h1" style={{ textAlign: 'center', marginBottom: 8 }}>Drug Safety Search</h1>
          <p className="text-body-lg" style={{ textAlign: 'center', marginBottom: 36 }}>Find reported side effects, safety alerts, and community experiences for any medicine.</p>
          <DrugSearchBar autoFocus onSelect={handleSelect} />
        </div>
      </div>

      {/* Popular categories */}
      <div className="container" style={{ maxWidth: 1100, padding: '48px 24px' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, marginBottom: 24 }}>Browse by Category</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
          {[
            { class: 'Antibiotic', count: 12 }, { class: 'Antidiabetic', count: 8 },
            { class: 'Antihypertensive', count: 10 }, { class: 'NSAID', count: 6 },
            { class: 'Statin', count: 7 }, { class: 'Proton Pump Inhibitor', count: 5 },
            { class: 'Antiepileptic', count: 4 }, { class: 'SSRI', count: 3 },
          ].map(({ class: cls, count }) => (
            <div key={cls} className="card card-hover" style={{ padding: 20, cursor: 'pointer' }}
              onClick={() => navigate(`/search?class=${encodeURIComponent(cls)}`)}
              role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && navigate(`/search?class=${encodeURIComponent(cls)}`)}
            >
              <ShieldCheck size={20} color="var(--color-primary)" style={{ marginBottom: 8 }} aria-hidden="true" />
              <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{cls}</p>
              <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{count} medicines</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
