import { useState, useCallback, useRef } from 'react';
import { Search, Mic, X } from 'lucide-react';
import { drugApi } from '../../utils/api.js';
import { useNavigate } from 'react-router-dom';

function debounce(fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

const POPULAR = ['Paracetamol', 'Metformin', 'Atorvastatin', 'Amoxicillin', 'Omeprazole', 'Ibuprofen'];

export function DrugSearchBar({ onSelect, autoFocus }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  const search = useCallback(
    debounce(async (q) => {
      if (!q.trim()) { setResults([]); setIsOpen(false); return; }
      setIsLoading(true);
      try {
        const { data } = await drugApi.search(q);
        setResults(data.drugs || []);
        setIsOpen(true);
      } catch { setResults([]); }
      finally { setIsLoading(false); }
    }, 300),
    []
  );

  const handleChange = (e) => {
    setQuery(e.target.value);
    search(e.target.value);
  };

  const handleSelect = (drug) => {
    setQuery(drug.name);
    setIsOpen(false);
    onSelect ? onSelect(drug) : navigate(`/drug/${encodeURIComponent(drug.name)}`);
  };

  const handleClear = () => { setQuery(''); setResults([]); setIsOpen(false); inputRef.current?.focus(); };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <Search size={20} color="var(--color-text-muted)" style={{ position: 'absolute', left: 18 }} aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          placeholder="Search medicines — e.g. Metformin, Atorvastatin..."
          autoFocus={autoFocus}
          aria-label="Search for a medicine"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          style={{
            width: '100%', height: 56, paddingLeft: 52, paddingRight: 80,
            borderRadius: 'var(--radius-full)', border: '1.5px solid var(--color-border)',
            fontSize: 16, fontFamily: 'var(--font-body)', outline: 'none',
            boxShadow: 'var(--shadow-sm)', background: 'var(--color-surface)',
            transition: 'border-color 0.2s, box-shadow 0.2s',
          }}
          onFocus={(e) => { e.target.style.borderColor = 'var(--color-primary)'; e.target.style.boxShadow = '0 0 0 3px var(--color-primary-glow)'; if (query) setIsOpen(true); }}
          onBlur={(e) => { e.target.style.borderColor = 'var(--color-border)'; e.target.style.boxShadow = 'var(--shadow-sm)'; setTimeout(() => setIsOpen(false), 200); }}
        />
        {query && (
          <button onClick={handleClear} style={{ position: 'absolute', right: 56, color: 'var(--color-text-muted)' }} aria-label="Clear search">
            <X size={18} />
          </button>
        )}
        <button style={{ position: 'absolute', right: 12, width: 38, height: 38, borderRadius: '50%', background: 'var(--color-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-label="Voice search">
          <Mic size={16} aria-hidden="true" />
        </button>
      </div>

      {/* Dropdown results */}
      {isOpen && (
        <div role="listbox" style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 8, background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-xl)', border: '1px solid var(--color-border)', zIndex: 100, overflow: 'hidden' }}>
          {isLoading ? (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--color-text-muted)' }}>Searching...</div>
          ) : results.length === 0 ? (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--color-text-muted)' }}>No medicines found</div>
          ) : (
            results.map((drug) => (
              <button
                key={drug.name}
                role="option"
                onClick={() => handleSelect(drug)}
                style={{ width: '100%', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--color-border)', background: 'transparent', textAlign: 'left', cursor: 'pointer' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-primary-light)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <div>
                  <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text-primary)' }}>{drug.name}</p>
                  <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{drug.generic} · {drug.class}</p>
                </div>
                <span style={{ marginLeft: 'auto', padding: '2px 8px', background: 'var(--color-primary-light)', color: 'var(--color-primary)', borderRadius: 'var(--radius-full)', fontSize: 11 }}>
                  {drug.common_adrs?.length || 0} ADRs
                </span>
              </button>
            ))
          )}
        </div>
      )}

      {/* Popular tags */}
      {!query && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
          <span style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: '28px' }}>Popular:</span>
          {POPULAR.map((drug) => (
            <button key={drug} onClick={() => { setQuery(drug); search(drug); }} style={{ padding: '4px 14px', borderRadius: 'var(--radius-full)', background: 'var(--color-primary-light)', color: 'var(--color-primary)', fontSize: 13, border: '1px solid rgba(22,156,154,0.2)', cursor: 'pointer' }}>
              {drug}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
