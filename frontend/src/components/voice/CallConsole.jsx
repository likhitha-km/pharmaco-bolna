import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PhoneCall, PhoneIncoming, PhoneOutgoing, Wrench, Siren, FileCheck2, Sparkles, CheckCircle2,
  Volume2, Loader, ChevronDown, ChevronUp, Radio, Languages, Clock, PhoneOff,
} from 'lucide-react';
import { ICSRReport } from '../report/ICSRReport.jsx';
import { voiceApi } from '../../utils/api.js';

const LANG_NAMES = { hi: 'Hindi', en: 'English', kn: 'Kannada', ta: 'Tamil', te: 'Telugu', mr: 'Marathi', bn: 'Bengali', gu: 'Gujarati', ml: 'Malayalam' };
const LIVE_STATUSES = ['queued', 'ringing', 'initiated', 'in-progress', 'call-disconnected'];

function StatusPill({ status }) {
  const live = LIVE_STATUSES.includes(status);
  const failed = ['failed', 'error', 'no-answer', 'busy', 'canceled', 'balance-low'].includes(status);
  const color = live ? '#059669' : failed ? '#DC2626' : 'var(--color-text-secondary)';
  const bg = live ? '#ECFDF5' : failed ? '#FEF2F2' : 'var(--color-surface-secondary)';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 'var(--radius-full)', background: bg, color, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {live && <span className="animate-pulse" style={{ width: 7, height: 7, borderRadius: '50%', background: '#10B981' }} />}
      {status === 'in-progress' ? 'Live' : status || 'queued'}
    </span>
  );
}

function CompletenessBar({ before, after }) {
  const color = (v) => (v >= 85 ? '#10B981' : v >= 60 ? '#0EA5E9' : v >= 40 ? '#F59E0B' : '#EF4444');
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 6 }}>
        <span>Report completeness</span>
        <span style={{ fontWeight: 700, color: color(after), fontSize: 14 }}>
          {before != null && before !== after && <span style={{ color: 'var(--color-text-muted)', fontWeight: 500, textDecoration: 'line-through', marginRight: 6 }}>{before}%</span>}
          {after}%
        </span>
      </div>
      <div style={{ height: 8, borderRadius: 999, background: 'var(--color-surface-secondary)', overflow: 'hidden', position: 'relative' }}>
        {before != null && before !== after && (
          <div style={{ position: 'absolute', inset: 0, width: `${before}%`, background: '#CBD5E1' }} />
        )}
        <motion.div initial={{ width: `${before ?? 0}%` }} animate={{ width: `${after}%` }} transition={{ duration: 1.2, ease: 'easeOut' }}
          style={{ position: 'absolute', inset: 0, background: color(after), borderRadius: 999 }} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Left: call list
// ─────────────────────────────────────────────────────────────────────────────
export function CallList({ calls, selectedId, onSelect }) {
  if (!calls.length) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 14 }}>
        <PhoneCall size={28} style={{ margin: '0 auto 8px', opacity: 0.4 }} aria-hidden="true" />
        Nothing here yet. Pick a sample call above to watch it.
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {calls.map((c) => {
        const Icon = c.direction === 'outbound' ? PhoneOutgoing : PhoneIncoming;
        const active = c.id === selectedId;
        return (
          <button key={c.id} onClick={() => onSelect(c.id)}
            style={{
              textAlign: 'left', padding: '12px 14px', border: 'none', borderBottom: '1px solid var(--color-border)',
              background: active ? 'var(--color-primary-light)' : 'transparent', cursor: 'pointer',
              borderLeft: `3px solid ${active ? 'var(--color-primary)' : c.emergency ? '#EF4444' : 'transparent'}`,
            }}
            aria-pressed={active}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Icon size={14} color={c.emergency ? '#DC2626' : 'var(--color-primary)'} aria-hidden="true" />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.medicine || (c.mode === 'followup' ? 'Follow-up call' : 'Side-effect report')}
              </span>
              <StatusPill status={c.status} />
            </div>
            <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--color-text-muted)', flexWrap: 'wrap' }}>
              <span>{LANG_NAMES[c.language] || c.language}</span>
              
              {c.completeness != null && <span>· {c.completeness}%</span>}
              {c.emergency && <span style={{ color: '#DC2626', fontWeight: 700 }}>· EMERGENCY</span>}
              {c.source === 'simulation' && <span>· sample</span>}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Centre: transcript
// ─────────────────────────────────────────────────────────────────────────────
function useSarvamSpeaker(language) {
  const [playing, setPlaying] = useState(null);
  const [unavailable, setUnavailable] = useState(false);
  const audioRef = useRef(null);

  const speak = async (key, text) => {
    audioRef.current?.pause();
    setPlaying(key);
    try {
      const { data } = await voiceApi.tts(text, language);
      const audio = new Audio(`data:audio/wav;base64,${data.audio}`);
      audioRef.current = audio;
      audio.onended = () => setPlaying(null);
      await audio.play();
    } catch {
      setUnavailable(true);
      setPlaying(null);
    }
  };
  useEffect(() => () => audioRef.current?.pause(), []);
  return { speak, playing, unavailable };
}

function Transcript({ call, transcript }) {
  const scrollRef = useRef(null);
  const { speak, playing, unavailable } = useSarvamSpeaker(call.language);
  // Scroll the panel only — scrollIntoView would drag the whole page along.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [transcript.length]);
  const translator = 'English';

  if (!transcript.length) {
    const waiting = LIVE_STATUSES.includes(call.status);
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: 14, padding: 32, textAlign: 'center' }}>
        {waiting ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Loader size={16} className="animate-spin" aria-hidden="true" />
            {call.source === 'simulation' ? 'Connecting…' : 'The call is in progress. The full transcript appears when it ends.'}
          </span>
        ) : 'No transcript for this call.'}
      </div>
    );
  }

  return (
    <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }} aria-live="polite">
      {transcript.map((t, i) => {
        const bot = t.role === 'assistant';
        const key = `${i}`;
        return (
          <motion.div key={key} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            style={{ alignSelf: bot ? 'flex-start' : 'flex-end', maxWidth: '82%' }}>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4, textAlign: bot ? 'left' : 'right', display: 'flex', gap: 6, justifyContent: bot ? 'flex-start' : 'flex-end', alignItems: 'center' }}>
              {bot ? 'Priya from Pharmaco' : 'Caller'}
              {bot && !unavailable && (
                <button onClick={() => speak(key, t.text)} title="Listen to this line" aria-label="Listen to this line"
                  style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: playing === key ? 'var(--color-primary)' : 'var(--color-text-muted)', display: 'inline-flex' }}>
                  {playing === key ? <Loader size={12} className="animate-spin" /> : <Volume2 size={12} />}
                </button>
              )}
            </div>
            <div style={{
              padding: '10px 14px', fontSize: 15, lineHeight: 1.6,
              background: bot ? 'var(--color-surface)' : 'var(--color-primary)',
              color: bot ? 'var(--color-text-primary)' : '#fff',
              border: bot ? '1px solid var(--color-border)' : 'none',
              borderRadius: bot ? '0 14px 14px 14px' : '14px 0 14px 14px',
            }}>
              {t.text}
              {t.text_en && (
                <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.25)', fontSize: 13, opacity: 0.9, fontStyle: 'italic' }}>
                  <span style={{ fontStyle: 'normal', fontSize: 10, fontWeight: 700, letterSpacing: 0.4, opacity: 0.8, marginRight: 6 }}>{translator.toUpperCase()}</span>
                  {t.text_en}
                </div>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Right: live intelligence — tool calls, pipeline, report
// ─────────────────────────────────────────────────────────────────────────────
// Plain-language description of what happened during the call. Internal tool
// and pipeline names never reach the screen.
const STEP_LABELS = {
  transcript: 'Call transcript received',
  emergency: 'Marked as serious for urgent review',
  extract: 'Reading the whole conversation',
  extracted: 'Details checked against the full conversation',
  meddra: 'Working out the medical terms for the reaction',
  causality: 'Checking how likely the medicine caused it',
  icsr: 'Preparing the safety report',
};

function describeEvent(e) {
  switch (e.type) {
    case 'call.status':
      return { icon: PhoneCall, tone: 'muted', title: e.status === 'in-progress' ? 'Call connected' : `Call ${e.status}` };
    case 'tool.call': {
      if (e.tool === 'check_emergency') return { icon: Wrench, tone: 'tool', title: 'Checking for danger signs' };
      if (e.tool === 'lookup_medicine') return { icon: Wrench, tone: 'tool', title: `Looking up “${String(e.args?.medicine_name || 'the medicine').slice(0, 40)}”` };
      if (e.tool === 'file_adr_report' || e.tool === 'update_adr_report') return { icon: Wrench, tone: 'tool', title: 'Saving the report' };
      return null;
    }
    case 'tool.result': {
      const r = e.result || {};
      if (e.tool === 'lookup_medicine') {
        return r.found
          ? { icon: CheckCircle2, tone: 'ok', title: `${r.matched_brand ? `${r.matched_brand} is ` : ''}${r.generic_name}`, detail: `${r.drug_class}. Known side effects include ${(r.known_side_effects || []).slice(0, 3).join(', ')}.${r.cdsco_safety_alerts?.length ? ' A safety alert is on record.' : ''}` }
          : { icon: Wrench, tone: 'muted', title: 'Medicine not recognised, so Priya asks the caller to spell it' };
      }
      if (e.tool === 'check_emergency') {
        return r.is_emergency
          ? { icon: Siren, tone: 'danger', title: 'Danger sign found. The caller is told to call 108 or 112.' }
          : { icon: CheckCircle2, tone: 'ok', title: 'No danger signs, so the conversation continues' };
      }
      if (e.tool === 'file_adr_report') return { icon: FileCheck2, tone: 'ok', title: 'Report saved', detail: `Priya reads the reference back to the caller: “${r.spoken_reference}”` };
      if (e.tool === 'update_adr_report') return { icon: FileCheck2, tone: 'ok', title: 'Report updated' };
      return null;
    }
    case 'emergency':
      return { icon: Siren, tone: 'danger', title: 'Emergency', detail: e.symptoms };
    case 'report.filed':
      return { icon: FileCheck2, tone: 'ok', title: `Report created, ${e.completeness}% complete` };
    case 'report.updated':
      return { icon: FileCheck2, tone: 'ok', title: `Missing details added, ${e.completenessBefore}% → ${e.completeness}% complete` };
    case 'pipeline.step':
      return STEP_LABELS[e.step] ? { icon: Sparkles, tone: e.step === 'emergency' ? 'danger' : 'ai', title: STEP_LABELS[e.step] } : null;
    case 'pipeline.done':
      return { icon: CheckCircle2, tone: 'ok', title: 'Safety report ready' };
    case 'call.ended':
      return e.note ? { icon: PhoneOff, tone: 'muted', title: e.note } : null;
    default:
      return null;
  }
}

const TONES = {
  muted: { fg: 'var(--color-text-muted)', bg: 'transparent' },
  tool: { fg: '#7C3AED', bg: '#F5F3FF' },
  ok: { fg: '#047857', bg: '#ECFDF5' },
  ai: { fg: 'var(--color-primary-dark)', bg: 'var(--color-primary-light)' },
  danger: { fg: '#B91C1C', bg: '#FEF2F2' },
};

function Timeline({ events }) {
  const items = events.map((e) => ({ e, d: describeEvent(e) })).filter((x) => x.d);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <AnimatePresence initial={false}>
        {items.map(({ e, d }, i) => {
          const tone = TONES[d.tone];
          const Icon = d.icon;
          return (
            <motion.div key={`${e.at}-${i}`} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
              style={{ display: 'flex', gap: 8, padding: '6px 8px', borderRadius: 8, background: tone.bg }}>
              <Icon size={14} color={tone.fg} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: tone.fg, wordBreak: 'break-word' }}>{d.title}</div>
                {d.detail && <div style={{ fontSize: 11.5, color: 'var(--color-text-secondary)', marginTop: 2 }}>{d.detail}</div>}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

function ReportSummary({ call, report }) {
  const [showIcsr, setShowIcsr] = useState(false);
  if (!report) return null;
  const x = report.extractedData || {};
  const med = x.suspected_medicines?.[0] || {};
  const mappings = report.meddraMapping?.meddra_mappings || [];
  const serious = report.icsr?.seriousness === 'Serious';

  return (
    <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--color-primary-dark)' }}>{report.id}</span>
        {report.icsr?.seriousness && <span className={`badge ${serious ? 'badge-error' : 'badge-success'}`}>{report.icsr.seriousness}</span>}
      </div>
      <div style={{ fontSize: 14 }}>
        <strong>{med.name || 'Unknown medicine'}</strong>
        {med.brand_name && <span style={{ color: 'var(--color-text-muted)' }}> ({med.brand_name})</span>}
        {med.dosage && <span style={{ color: 'var(--color-text-secondary)' }}> · {med.dosage}{med.frequency ? `, ${med.frequency}` : ''}</span>}
      </div>
      {mappings.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {mappings.map((m, i) => (
            <span key={i} style={{ fontSize: 12, padding: '3px 8px', borderRadius: 6, background: 'var(--color-surface-secondary)' }}>
              {m.preferred_term}
            </span>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{x.adverse_reactions?.[0]?.english_translation || report.reaction}</div>
      )}
      {report.causality?.category && (
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>How likely the medicine caused it: <strong style={{ color: 'var(--color-text-primary)' }}>{report.causality.category}</strong></div>
      )}
      <CompletenessBar before={call.mode === 'followup' ? call.completenessBefore : null} after={report.completenessScore ?? call.completeness ?? 0} />
      {report.voiceCall?.recordingUrl && <audio controls src={report.voiceCall.recordingUrl} style={{ width: '100%', height: 32 }} />}
      {report.icsr ? (
        <>
          <button className="btn btn-outline btn-sm" onClick={() => setShowIcsr((s) => !s)} aria-expanded={showIcsr}>
            {showIcsr ? <ChevronUp size={14} /> : <ChevronDown size={14} />} {showIcsr ? 'Hide' : 'View'} full report
          </button>
          {showIcsr && <div style={{ maxHeight: 520, overflowY: 'auto' }}><ICSRReport report={report.icsr} /></div>}
        </>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--color-text-muted)' }}>
          <Loader size={13} className="animate-spin" aria-hidden="true" /> Preparing the safety report…
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Console
// ─────────────────────────────────────────────────────────────────────────────
export function CallConsole({ calls, selected, details, report, onSelect }) {
  return (
    <div className="card voice-console" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-secondary)' }}>
        <Radio size={16} color="var(--color-primary)" aria-hidden="true" />
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16 }}>The call</span>
      </div>

      <div className="voice-console-grid">
        <div className="voice-console-list">
          <CallList calls={calls} selectedId={selected?.id} onSelect={onSelect} />
        </div>

        {selected ? (
          <>
            <div className="voice-console-main">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--color-border)', flexWrap: 'wrap' }}>
                <StatusPill status={selected.status} />
                <span style={{ fontSize: 14, fontWeight: 600 }}>{selected.title || 'Side-effect report call'}</span>
                <span style={{ marginLeft: 'auto', display: 'flex', gap: 12, fontSize: 12, color: 'var(--color-text-muted)', alignItems: 'center' }}>
                  <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><Languages size={13} />{LANG_NAMES[selected.language] || selected.language}</span>
                  {selected.durationSec != null && <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><Clock size={13} />{Math.floor(selected.durationSec / 60)}:{String(selected.durationSec % 60).padStart(2, '0')}</span>}
                  {selected.callerMasked && <span>{selected.callerMasked}</span>}
                  <span className={`badge ${selected.source === 'simulation' ? 'badge-info' : 'badge-primary'}`}>{selected.source === 'simulation' ? 'Sample call' : 'Phone call'}</span>
                </span>
              </div>
              {selected.emergency && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: '#FEF2F2', color: '#B91C1C', fontSize: 14, fontWeight: 600, borderBottom: '1px solid #FECACA' }}>
                  <Siren size={18} aria-hidden="true" /> Danger sign spotted. The caller was told to call 108 (ambulance) or 112, and the report is marked for urgent review.
                </div>
              )}
              <Transcript call={selected} transcript={details?.transcript || []} />
            </div>

            <div className="voice-console-side">
              <ReportSummary call={selected} report={report} />
              <div>
                <div className="text-label" style={{ marginBottom: 8 }}>What happened during the call</div>
                <Timeline events={details?.events || []} />
              </div>
            </div>
          </>
        ) : (
          <div style={{ gridColumn: 'span 2', padding: 48, textAlign: 'center', color: 'var(--color-text-muted)' }}>Choose a call from the list</div>
        )}
      </div>
    </div>
  );
}
