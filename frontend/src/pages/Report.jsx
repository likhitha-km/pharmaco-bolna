import { useState, useEffect, useRef } from 'react';
import ErrorBoundary from '../components/ErrorBoundary.jsx';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, Phone, AudioLines, SlidersHorizontal, X, PlayCircle } from 'lucide-react';
import { ConversationWindow } from '../components/conversation/ConversationWindow.jsx';
import { CompletenessScore } from '../components/report/CompletenessScore.jsx';
import { useConversation, ACTIVE_CONVERSATION_KEY } from '../hooks/useConversation.js';
import { useLanguageContext } from '../context/LanguageContext.jsx';
import { useReportProgress } from '../hooks/useReportProgress.js';
import { LANGUAGES } from '../utils/i18n.js';

export default function Report() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { language, setLanguage } = useLanguageContext();
  const [userType, setUserType] = useState('patient');
  const [isAnonymous, setIsAnonymous] = useState(true);
  // A ref, not state: React Strict Mode runs effects twice back-to-back, and state
  // set in the first run is not visible to the second — which started two
  // conversations and showed two welcome messages.
  const initStartedRef = useRef(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const {
    startConversation,
    hydrateConversation,
    conversationId,
    extractedData,
    completenessScore,
    isReportReady,
    changeLanguage,
    changeUserType,
    changeAnonymous,
  } = useConversation();
  const progress = useReportProgress(extractedData);

  useEffect(() => {
    const initConversation = async () => {
      if (initStartedRef.current || conversationId) return;
      initStartedRef.current = true;

      // Resume an in-progress conversation after a refresh instead of
      // silently starting a new one and orphaning the old chat history.
      // "?new=true" (used by "New Report" in My Reports) skips this.
      const forceNew = searchParams.get('new') === 'true';
      // "?resume=<id>" — "Continue in chat" from My Reports. The backend only
      // returns a conversation to the user who started it.
      let storedId = searchParams.get('resume');
      if (!storedId && !forceNew) {
        try { storedId = localStorage.getItem(ACTIVE_CONVERSATION_KEY); } catch { /* ignore */ }
      }

      if (storedId) {
        const restored = await hydrateConversation(storedId);
        // Stale, deleted, or already-submitted — don't resurrect it.
        if (!restored || restored.status === 'completed') {
          try { localStorage.removeItem(ACTIVE_CONVERSATION_KEY); } catch { /* ignore */ }
          await startConversation(userType, language, isAnonymous);
        } else {
          try { localStorage.setItem(ACTIVE_CONVERSATION_KEY, storedId); } catch { /* ignore */ }
          if (restored.language) setLanguage(restored.language);
        }
        return;
      }

      await startConversation(userType, language, isAnonymous);
    };
    initConversation();
  }, [conversationId]);

  const handleReportReady = () => {
    if (conversationId) navigate(`/report/review/${conversationId}`);
  };

  const handleLanguageChange = (code) => {
    setLanguage(code);
    changeLanguage(code);
  };

  return (
    <ErrorBoundary>
    <main className="page-content report-layout">
      {detailsOpen && <div className="report-sidebar-backdrop" onClick={() => setDetailsOpen(false)} aria-hidden="true" />}
      {/* Left sidebar */}
      <aside className={`report-sidebar${detailsOpen ? ' is-open' : ''}`} aria-label="Report settings sidebar">
        <button className="btn btn-ghost btn-sm report-sidebar-close" onClick={() => setDetailsOpen(false)} aria-label="Close report details">
          <X size={16} aria-hidden="true" /> Close
        </button>
        {/* Language selector */}
        <div>
          <label htmlFor="lang-select" style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 8 }}>
            Language
          </label>
          <select
            id="lang-select"
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value)}
            className="input"
            style={{ height: 44 }}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>{l.native} — {l.label}</option>
            ))}
          </select>
        </div>

        {/* User type toggle */}
        <div>
          <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>I am a</p>
          <div style={{ display: 'flex', gap: 8 }}>
            {[{ value: 'patient', label: 'Patient' }, { value: 'healthcare_professional', label: 'Healthcare Professional' }].map(({ value, label }) => (
              <button
                key={value}
                onClick={() => {
                  setUserType(value);
                  changeUserType(value);
                }}
                style={{
                  flex: 1, padding: '10px 8px', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500,
                  background: userType === value ? 'var(--color-primary)' : 'var(--color-surface-secondary)',
                  color: userType === value ? '#fff' : 'var(--color-text-secondary)',
                  border: `1px solid ${userType === value ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  cursor: 'pointer', transition: 'all 0.2s',
                }}
                aria-pressed={userType === value}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Anonymous toggle */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={isAnonymous}
            onChange={(e) => {
              setIsAnonymous(e.target.checked);
              changeAnonymous(e.target.checked);
            }}
            style={{ width: 16, height: 16, accentColor: 'var(--color-primary)', cursor: 'pointer' }}
            aria-label="Report anonymously"
          />
          <span style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>Report anonymously</span>
        </label>

        {/* Report progress */}
        <div>
          <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
            Report Progress
          </p>
          {extractedData ? (
            <CompletenessScore score={completenessScore || progress.percentage} fields={progress.fields} />
          ) : (
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Start the conversation to track progress</p>
          )}
          {progress.fields.length > 0 && (
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {progress.fields.map((f) => (
                <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircle
                    size={14}
                    color={f.filled ? '#10B981' : '#E5E7EB'}
                    aria-hidden="true"
                  />
                  <span style={{ fontSize: 12, color: f.filled ? 'var(--color-text-primary)' : 'var(--color-text-muted)', fontWeight: f.required ? 500 : 400 }}>
                    {f.label}{f.required ? ' *' : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Save & resume */}
        <div style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
          Your conversation is saved as you go. Use <strong>Save &amp; finish later</strong> to keep a draft in My Reports and continue it any time.
        </div>

        {/* Emergency contacts */}
        <div style={{ padding: 16, background: '#FEF2F2', borderRadius: 'var(--radius-md)', border: '1px solid #FCA5A5' }}>
          <p style={{ fontWeight: 600, fontSize: 13, color: '#DC2626', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Phone size={14} aria-hidden="true" /> Emergency Contacts
          </p>
          <p style={{ fontSize: 12, color: '#7F1D1D' }}>National Helpline: <strong>1800-180-3024</strong></p>
          <p style={{ fontSize: 11, color: '#B91C1C', marginTop: 4 }}>Toll free, 9AM-5:30PM weekdays</p>
          <a href="tel:112" style={{ display: 'block', marginTop: 8, fontSize: 14, fontWeight: 700, color: '#DC2626' }}>
            Emergency: 112
          </a>
          <a href="tel:108" style={{ display: 'block', marginTop: 2, fontSize: 13, fontWeight: 600, color: '#DC2626' }}>
            Ambulance: 108
          </a>
        </div>

        <Link to="/demo" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--color-text-muted)' }}>
          <PlayCircle size={14} aria-hidden="true" /> Explore demo scenarios
        </Link>
      </aside>

      {/* Main chat window */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Top bar */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--color-surface)' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <AudioLines size={18} color="#fff" aria-hidden="true" />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16 }}>Pharmaco Voice</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span className="report-subtitle" style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Multilingual Voice Based Adverse Drug Reaction Reporting</span>
              <span style={{ padding: '1px 8px', background: 'var(--color-primary-light)', color: 'var(--color-primary)', borderRadius: 'var(--radius-full)', fontSize: 11, fontWeight: 500 }}>
                {LANGUAGES.find((l) => l.code === language)?.native || language}
              </span>
            </div>
          </div>
          <button className="btn btn-outline btn-sm report-details-toggle" onClick={() => setDetailsOpen(true)} aria-label="Show report details and progress">
            <SlidersHorizontal size={14} aria-hidden="true" /> {extractedData ? `${completenessScore || progress.percentage}%` : 'Details'}
          </button>
        </div>

        <ConversationWindow
          language={language}
          userType={userType}
          onReportReady={handleReportReady}
          onLanguageChange={handleLanguageChange}
        />
      </div>
    </main>
    </ErrorBoundary>
  );
}
