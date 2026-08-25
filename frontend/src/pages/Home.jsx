import { Link } from 'react-router-dom';
import { ShieldCheck, Globe, FileText, ArrowRight, MessageSquare, BarChart2, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../auth/AuthProvider.jsx';

const STATS = [
  { value: '1,247+', label: 'Reports Received' },
  { value: '9', label: 'Indian Languages' },
  { value: '28+', label: 'AMCs Connected' },
];

const STEPS = [
  { icon: MessageSquare, title: 'Tell us what happened', desc: 'Start a simple conversation. Describe the side effect in your own words — no forms, no jargon.' },
  { icon: Globe, title: 'We understand your language', desc: 'Hindi, Tamil, Telugu, Kannada, Marathi, Bengali and more. Speak or type naturally.' },
  { icon: ShieldCheck, title: 'Safety reaches regulators', desc: 'Your report is automatically structured and routed to India\'s PvPI network for expert review.' },
];

export default function Home() {
  const { user } = useAuth();

  const primaryCta = user
    ? { to: '/report', label: 'Report a Side Effect' }
    : { to: '/signup', label: 'Create an Account' };

  const secondaryCta = user
    ? { to: '/search', label: 'Search a Medicine' }
    : { to: '/login', label: 'Log In' };

  return (
    <main className="page-content" id="main-content">
      {/* ---- HERO ---- */}
      <section style={{ padding: '80px 0 64px', background: 'var(--color-surface)' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: '55fr 45fr', gap: 64, alignItems: 'center' }}>
            {/* Left */}
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              {/* Badge */}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', background: 'var(--color-primary-light)', borderRadius: 'var(--radius-full)', marginBottom: 28 }}>
                <ShieldCheck size={16} color="var(--color-primary)" aria-hidden="true" />
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-primary)' }}>India's Pharmacovigilance Platform</span>
              </div>

              <h1 className="text-hero" style={{ marginBottom: 24, letterSpacing: '-0.5px' }}>
                Know what other Indians experience with their medicines.
              </h1>
              <p className="text-body-lg" style={{ maxWidth: 520, marginBottom: 36, lineHeight: 1.8 }}>
                Report a side effect in your language. See real experiences from across India. Help make medicines safer for everyone.
              </p>

              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 48 }}>
                <Link to={primaryCta.to}>
                  <button className="btn btn-primary btn-lg" aria-label={primaryCta.label}>
                    {primaryCta.label} <ArrowRight size={18} aria-hidden="true" />
                  </button>
                </Link>
                <Link to={secondaryCta.to}>
                  <button className="btn btn-outline btn-lg" aria-label={secondaryCta.label}>
                    {secondaryCta.label}
                  </button>
                </Link>
              </div>

              {/* Trust signals */}
              <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
                {[
                  { icon: ShieldCheck, text: 'Voluntary & Confidential' },
                  { icon: Globe, text: '10+ Indian Languages' },
                  { icon: FileText, text: 'CDSCO PvPI Aligned' },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icon size={18} color="var(--color-primary)" aria-hidden="true" />
                    <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-secondary)' }}>{text}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Right — Floating drug card */}
            <motion.div
              initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.2 }}
              style={{ transform: 'rotate(-2deg)' }}
            >
              <div className="card" style={{ padding: 24, boxShadow: 'var(--shadow-xl)', transform: 'rotate(-2deg)', position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ShieldCheck size={20} color="var(--color-primary)" aria-hidden="true" />
                  </div>
                  <div>
                    <p style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 18 }}>Metformin 500mg</p>
                    <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Type 2 Diabetes · 3 reports this week</p>
                  </div>
                </div>

                {[
                  { reaction: 'चक्कर आना', en: 'Dizziness', code: '10013573', severity: 'mild' },
                  { reaction: 'मतली', en: 'Nausea', code: '10028813', severity: 'mild' },
                  { reaction: 'हाथ काँपना', en: 'Tremor', code: '10044565', severity: 'moderate' },
                ].map((adr) => (
                  <div key={adr.code} style={{ padding: '10px 12px', background: 'var(--color-surface-secondary)', borderRadius: 'var(--radius-md)', marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <p style={{ fontSize: 15, fontWeight: 500 }}>{adr.reaction}</p>
                        <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{adr.en}</p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-primary)', background: 'var(--color-primary-light)', padding: '2px 6px', borderRadius: 4 }}>
                          {adr.code}
                        </span>
                        <p style={{ fontSize: 11, color: adr.severity === 'moderate' ? '#D97706' : '#10B981', marginTop: 2, textAlign: 'right', fontWeight: 500 }}>
                          {adr.severity}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>WHO-UMC: <strong>Probable</strong> · MedDRA coded</p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ---- HOW IT WORKS ---- */}
      <section style={{ padding: '80px 0', background: 'var(--color-bg)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <h2 className="text-h2">How Pharmaco Works</h2>
            <p className="text-body-lg" style={{ marginTop: 8 }}>Three steps to safer medicines for India</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 32, position: 'relative' }}>
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={i}
                  className="card" style={{ padding: 32, textAlign: 'center' }}
                  initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} viewport={{ once: true }}
                >
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                    <Icon size={24} color="#fff" aria-hidden="true" />
                  </div>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--color-primary)', fontSize: 14 }}>
                    {i + 1}
                  </div>
                  <h3 className="text-h4" style={{ marginBottom: 12 }}>{step.title}</h3>
                  <p className="text-body" style={{ lineHeight: 1.7 }}>{step.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ---- STATS BAR ---- */}
      <section style={{ background: 'var(--color-primary)', padding: '40px 0' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32, textAlign: 'center' }}>
            {STATS.map(({ value, label }) => (
              <div key={label}>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: 42, fontWeight: 700, color: '#fff' }}>{value}</p>
                <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- PRODUCT EXPERIENCE ---- */}
      <section style={{ padding: '80px 0', background: 'var(--color-surface)' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }}>
            <div>
              <h2 className="text-h2" style={{ marginBottom: 16 }}>Your Drug Safety Co-pilot</h2>
              <p className="text-body-lg" style={{ marginBottom: 24, lineHeight: 1.8 }}>
                Just describe what happened — in Hindi, Tamil, Telugu, or any Indian language. Pharmaco's AI understands you, extracts the key information, and routes it to India's pharmacovigilance network automatically.
              </p>
              <Link to={user ? '/report' : '/signup'}>
                <button className="btn btn-primary btn-lg" aria-label="Start a conversation">
                  {user ? 'Start a Conversation' : 'Sign up to Start'} <ArrowRight size={18} aria-hidden="true" />
                </button>
              </Link>
            </div>

            {/* Example workflow */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <ShieldCheck size={20} color="#fff" aria-hidden="true" />
                <span style={{ color: '#fff', fontWeight: 600, fontFamily: 'var(--font-display)' }}>Pharmaco Assistant</span>
                <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, color: '#B2F5EA', fontSize: 12 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ADE80' }} />Online
                </span>
              </div>
              <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { role: 'bot', text: 'नमस्ते! मैं Pharmaco का सहायक हूं। आप जो दवाई ले रहे थे, उसका नाम बताइए।' },
                  { role: 'user', text: 'Metformin 500mg' },
                  { role: 'bot', text: 'धन्यवाद। Metformin लेने के बाद आपको क्या तकलीफ हुई?' },
                  { role: 'user', text: 'chakkar aaya aur haath kaanpne lage' },
                ].map((msg, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      maxWidth: '80%', padding: '10px 14px',
                      background: msg.role === 'user' ? 'var(--color-primary)' : 'var(--color-surface-secondary)',
                      color: msg.role === 'user' ? '#fff' : 'var(--color-text-primary)',
                      borderRadius: msg.role === 'user' ? '14px 0 14px 14px' : '0 14px 14px 14px',
                      fontSize: 14, lineHeight: 1.6,
                    }}>
                      {msg.text}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---- TWO COLUMN CTA ---- */}
      <section style={{ padding: '64px 0', background: 'var(--color-bg)' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            {[
              {
                icon: Users, title: 'For Patients & Caregivers',
                desc: 'Report a side effect in your language. No medical knowledge required. Completely voluntary and confidential.',
                cta: 'Report a Side Effect', to: '/report', primary: true,
              },
              {
                icon: BarChart2, title: 'For Healthcare Professionals',
                desc: 'Submit structured ADR reports with MedDRA coding, causality assessment, and ICSR generation — all automated.',
                cta: 'Professional Reporting', to: '/report', primary: false,
              },
            ].map(({ icon: Icon, title, desc, cta, to, primary }) => (
              <div key={title} className="card" style={{ padding: 32 }}>
                <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-md)', background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                  <Icon size={24} color="var(--color-primary)" aria-hidden="true" />
                </div>
                <h3 className="text-h3" style={{ marginBottom: 12 }}>{title}</h3>
                <p className="text-body" style={{ marginBottom: 24, lineHeight: 1.7 }}>{desc}</p>
                <Link to={user ? to : '/signup'}>
                  <button className={`btn ${primary ? 'btn-primary' : 'btn-outline'}`} aria-label={cta}>
                    {user ? cta : 'Create account'} <ArrowRight size={16} aria-hidden="true" />
                  </button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
