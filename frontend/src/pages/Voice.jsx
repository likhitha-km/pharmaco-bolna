import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PlayCircle, Siren, Languages, ShieldCheck, Loader, MessageCircle, Eye, FileCheck2 } from 'lucide-react';
import { voiceApi } from '../utils/api.js';
import { useVoiceConsole } from '../hooks/useVoiceConsole.js';
import { CallConsole } from '../components/voice/CallConsole.jsx';
import { showToast } from '../components/common/Toast.jsx';

const LANG_NAMES = { hi: 'Hindi', en: 'English', kn: 'Kannada', ta: 'Tamil', te: 'Telugu', mr: 'Marathi', bn: 'Bengali', gu: 'Gujarati', ml: 'Malayalam' };
const SCENARIO_ICONS = { 'hi-metformin': Languages, 'ta-amoxicillin': Languages, 'hi-emergency': Siren };

const STEPS = [
  { icon: PlayCircle, title: 'Pick a sample call', desc: 'Choose one of the situations below.' },
  { icon: Eye, title: 'Watch it unfold', desc: 'Follow the conversation and see what Pharmaco does at each step.' },
  { icon: FileCheck2, title: 'See the report', desc: 'A ready-to-review safety report is prepared from the call.' },
];

const CARE = [
  ['Safety comes first', 'If someone describes a danger sign, they are told right away to call 108 (ambulance) or 112, and the report is marked as serious.'],
  ['No medical advice', 'Priya never tells anyone to stop or change a medicine. She points them to their doctor.'],
  ['Checked before saving', 'Key details are repeated back in the caller’s own language and confirmed.'],
  ['Your privacy', 'Only the last four digits of a phone number are kept, and initials are used instead of names.'],
];

function SectionTitle({ eyebrow, title, sub }) {
  return (
    <div style={{ marginBottom: 24 }}>
      {eyebrow && <div className="text-label" style={{ color: 'var(--color-primary)', marginBottom: 6 }}>{eyebrow}</div>}
      <h2 className="text-h2" style={{ marginBottom: 6 }}>{title}</h2>
      {sub && <p className="text-body" style={{ maxWidth: 720 }}>{sub}</p>}
    </div>
  );
}

export default function Voice() {
  const [scenarios, setScenarios] = useState([]);
  const [running, setRunning] = useState(null);
  const [speed, setSpeed] = useState(1);
  const consoleRef = useRef(null);
  const vc = useVoiceConsole();

  useEffect(() => {
    voiceApi.scenarios().then(({ data }) => setScenarios(data.scenarios)).catch(() => {});
  }, []);

  // Only the sample conversations people can actually follow end to end.
  const samples = scenarios.filter((s) => s.mode !== 'followup');
  const firstSample = samples[0]?.id || 'hi-metformin';

  const scrollToConsole = () => consoleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const runScenario = async (id) => {
    setRunning(id);
    vc.followNextCall();
    try {
      await voiceApi.simulate(id, speed);
      scrollToConsole();
    } catch (err) {
      showToast(err.response?.data?.error || 'Could not start the sample call. Please try again.', 'error');
    } finally {
      setTimeout(() => setRunning(null), 1500);
    }
  };

  return (
    <main className="page-content" id="main-content">
      {/* ── HERO ── */}
      <section style={{ padding: '56px 0 40px', background: 'linear-gradient(180deg, var(--color-surface) 0%, var(--color-bg) 100%)' }}>
        <div className="container voice-hero">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', background: 'var(--color-primary-light)', borderRadius: 'var(--radius-full)', marginBottom: 20 }}>
              <PlayCircle size={16} color="var(--color-primary)" aria-hidden="true" />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-primary)' }}>Sample calls</span>
            </div>
            <h1 className="text-hero" style={{ marginBottom: 18, letterSpacing: '-0.5px' }}>
              See Pharmaco Voice at work.
            </h1>
            <p className="text-body-lg" style={{ maxWidth: 560, lineHeight: 1.75, marginBottom: 28 }}>
              Watch how Pharmaco helps someone report a medicine side effect, in their own language, and turns the conversation into a
              safety report. These are made-up examples, not real patients.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button className="btn btn-primary btn-lg" onClick={() => runScenario(firstSample)} disabled={!!running}>
                {running ? <Loader size={18} className="animate-spin" /> : <PlayCircle size={18} />} Watch a sample call
              </button>
              <Link to="/report"><button className="btn btn-outline btn-lg"><MessageCircle size={18} /> Report in chat</button></Link>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}>
            <div className="card" style={{ padding: 28, boxShadow: 'var(--shadow-xl)' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--color-primary-dark)', marginBottom: 16 }}>How it works</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {STEPS.map(({ icon: Icon, title, desc }, i) => (
                  <div key={title} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <span style={{ width: 36, height: 36, borderRadius: 12, background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={18} color="var(--color-primary)" aria-hidden="true" />
                    </span>
                    <div>
                      <div style={{ fontWeight: 600 }}>{i + 1}. {title}</div>
                      <div style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── WHY ── */}
      <section style={{ background: 'var(--color-primary)', padding: '28px 0' }}>
        <div className="container voice-why">
          {[
            { k: '94%', v: 'of side effects go unreported worldwide, according to a widely cited review (Hazell & Shakir, 2006)' },
            { k: '9', v: 'Indian languages you can speak or type in' },
            { k: 'About a minute', v: 'from the end of a sample call to a safety report ready to review' },
          ].map(({ k, v }) => (
            <div key={k}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 700, color: '#fff' }}>{k}</div>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', maxWidth: 300 }}>{v}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── SAMPLE CALLS + CONSOLE ── */}
      <section style={{ padding: '32px 0 24px' }}>
        <div className="container">
          <SectionTitle eyebrow="Try it" title="Pick a sample call"
            sub="Each one acts out a real-life situation. Watch the conversation, then see the safety report it produces. Reports from these samples are marked as examples." />
          <div className="voice-scenarios">
            {samples.map((s) => {
              const Icon = SCENARIO_ICONS[s.id] || PlayCircle;
              const danger = s.id === 'hi-emergency';
              return (
                <div key={s.id} className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icon size={18} color={danger ? '#DC2626' : 'var(--color-primary)'} aria-hidden="true" />
                    <span className="badge" style={{ fontSize: 12 }}>{LANG_NAMES[s.language] || s.language}</span>
                    {danger && <span className="badge badge-error" style={{ fontSize: 12 }}>Emergency</span>}
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 15, lineHeight: 1.35 }}>{s.title}</div>
                  <div style={{ fontSize: 14, color: 'var(--color-text-secondary)', flex: 1, lineHeight: 1.5 }}>{s.highlight}</div>
                  <button className="btn btn-outline btn-sm" onClick={() => runScenario(s.id)} disabled={running === s.id}>
                    {running === s.id ? <Loader size={14} className="animate-spin" /> : <PlayCircle size={14} />} Watch this call
                  </button>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0 20px', fontSize: 13, color: 'var(--color-text-secondary)' }}>
            Playback speed
            {[1, 1.5, 2].map((s) => (
              <button key={s} className={`btn btn-sm ${speed === s ? 'btn-primary' : 'btn-ghost'}`} style={{ minHeight: 28, padding: '0 10px' }} onClick={() => setSpeed(s)}>{s}×</button>
            ))}
          </div>

          <div ref={consoleRef} style={{ scrollMarginTop: 90 }}>
            <CallConsole
              calls={vc.calls}
              selected={vc.selected}
              details={vc.selectedDetails}
              report={vc.selectedReport}
              onSelect={vc.selectCall}
            />
          </div>
        </div>
      </section>

      {/* ── CARE ── */}
      <section style={{ padding: '40px 0 72px' }}>
        <div className="container">
          <SectionTitle eyebrow="Built to be careful" title="How Pharmaco looks after the person reporting" />
          <div style={{ display: 'grid', gap: 14 }} className="voice-guardrails">
            {CARE.map(([t, d]) => (
              <div key={t} style={{ display: 'flex', gap: 10 }}>
                <ShieldCheck size={18} color="var(--color-primary)" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
                <div><strong style={{ fontSize: 15 }}>{t}.</strong> <span style={{ fontSize: 15, color: 'var(--color-text-secondary)' }}>{d}</span></div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
