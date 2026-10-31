import { v4 as uuidv4 } from 'uuid';
import { triageMessage } from '../agents/triageAgent.js';
import { extractFromConversation } from '../agents/extractionAgent.js';
import { mapToMedDRA } from '../agents/mappingAgent.js';
import { assessCompleteness } from '../agents/completenessAgent.js';
import { generateICSR } from '../agents/reportAgent.js';
import { saveConversation, updateConversation, getReport, saveReport, updateDrugSignals, getDrugSignals } from '../services/firebaseService.js';
import { translateText } from '../services/sarvamService.js';
import { getAgentRegistry } from '../services/bolnaService.js';
import { mergeExtractedData } from '../utils/extractedData.js';
import { findDrug, findDrugInText, alertsFor } from './drugLookup.js';
import { VOICE_LANGUAGES, toVoiceLang } from './languages.js';
import { getCall, listCalls, upsertCall, pushEvent, maskPhone } from './voiceStore.js';

// Everything that happens because of a phone call lives here. Bolna's tool
// calls and status webhooks (routes/voice.js) and the scripted demo calls
// (demoScenarios.js) both drive these same functions.

const TERMINAL_STATUSES = new Set(['completed', 'no-answer', 'busy', 'failed', 'canceled', 'stopped', 'error', 'balance-low']);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Drop empty values and template placeholders Bolna didn't fill. */
function clean(value) {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s || s.includes('%(') || /^\{\{?[a-z_]+\}?\}$/i.test(s)) return null;
  if (/^(unknown|none|n\/a|na|null|not sure|not known)$/i.test(s)) return null;
  return s;
}

function oneOf(value, allowed, fallback) {
  const v = clean(value)?.toLowerCase().replace(/\s+/g, '_');
  return allowed.includes(v) ? v : fallback;
}

/** "PVP-8F2A91C4" → "P V P, 9 1 C 4" — the last four is what callers will quote. */
export function spokenRef(reportId) {
  const tail = reportId.slice(-4).split('').join(' ');
  return `P V P, ${tail}`;
}

/** Fill only the gaps in `base` from `incoming` — base (caller-confirmed) wins. */
function fillGaps(base, incoming) {
  const empty = (v) => v == null || v === '' || v === 'unknown' || (Array.isArray(v) && v.length === 0);
  if (Array.isArray(base) && Array.isArray(incoming)) {
    const out = base.map((item, i) => (incoming[i] && typeof item === 'object' ? fillGaps(item, incoming[i]) : item));
    return out.length ? out : incoming;
  }
  if (base && typeof base === 'object' && incoming && typeof incoming === 'object') {
    const out = { ...base };
    for (const [k, v] of Object.entries(incoming)) {
      out[k] = empty(out[k]) ? v : (typeof out[k] === 'object' ? fillGaps(out[k], v) : out[k]);
    }
    return out;
  }
  return empty(base) ? incoming : base;
}

/** Map the voice agent's flat tool arguments onto Pharmaco's extraction schema. */
export function toolArgsToExtracted(args, lang) {
  const spokenName = clean(args.medicine_name);
  const match = spokenName ? findDrug(spokenName) : null;
  const outcome = clean(args.outcome);
  const age = clean(args.patient_age);

  const medicine = {
    name: match?.drug.name || spokenName,
    brand_name: match?.kind === 'brand' ? match.matched : null,
    dosage: clean(args.dosage),
    frequency: clean(args.frequency),
    route: null,
    start_date: null,
    stop_date: null,
    confidence: match ? 0.95 : 0.7,
  };
  const reaction = {
    original_text: clean(args.reaction_original) || clean(args.reaction_description),
    english_translation: clean(args.reaction_description),
    onset_date: clean(args.onset),
    resolution_date: null,
    duration: null,
    severity: oneOf(args.severity, ['mild', 'moderate', 'severe'], null),
    still_ongoing: outcome ? !/recovered|resolved|theek|fine/i.test(outcome) || /not recovered/i.test(outcome) : null,
    confidence: 0.85,
  };
  const hosp = clean(args.hospitalised)?.toLowerCase();

  return {
    suspected_medicines: medicine.name ? [medicine] : [],
    adverse_reactions: reaction.english_translation || reaction.original_text ? [reaction] : [],
    patient: {
      initials: clean(args.patient_initials),
      age_group: age ? (/^\d+$/.test(age) ? `${age} years` : age) : null,
      gender: oneOf(args.patient_gender, ['male', 'female', 'other'], null),
    },
    causality_signals: {
      dechallenge: oneOf(args.dechallenge, ['positive', 'negative'], 'unknown'),
      rechallenge: oneOf(args.rechallenge, ['positive', 'negative'], 'not_applicable'),
    },
    clinical_context: {
      reason_for_taking: clean(args.reason_for_taking),
      medical_history: clean(args.medical_history),
      concomitant_medications: (clean(args.other_medicines) || '').split(',').map((m) => m.trim()).filter((m) => m && !/^(none|no|nothing)$/i.test(m)),
      hospitalization: hosp ? /^(yes|y|true|haan|ha)/.test(hosp) : null,
      outcome,
    },
    metadata: {
      language_detected: VOICE_LANGUAGES[lang]?.bcp47 || 'hi-IN',
      reporter_type: oneOf(args.reporter_type, ['patient', 'caregiver', 'healthcare_professional'], 'patient'),
      report_type: 'adr',
    },
  };
}

/** Parse Bolna's "assistant: …\nuser: …" transcript into turns. */
export function parseTranscript(transcript) {
  if (Array.isArray(transcript)) return transcript;
  const turns = [];
  for (const line of String(transcript || '').split('\n')) {
    const m = line.match(/^\s*(assistant|user|agent|bot|human|caller)\s*:\s*(.*)$/i);
    if (m) {
      const role = /assistant|agent|bot/i.test(m[1]) ? 'assistant' : 'user';
      if (m[2].trim()) turns.push({ role, text: m[2].trim() });
    } else if (line.trim() && turns.length) {
      turns[turns.length - 1].text += ` ${line.trim()}`;
    }
  }
  return turns;
}

function agentLookup(agentId) {
  const entry = Object.entries(getAgentRegistry()).find(([, id]) => id === agentId);
  if (!entry) return {};
  const [mode, lang] = entry[0].split(':');
  return { mode, language: lang };
}

/**
 * Work out which call a tool hit belongs to. Bolna substitutes {execution_id}
 * into the tool params; if that ever comes through unfilled we attach to the
 * most recent live call on the same agent.
 */
export function resolveCallId(args = {}) {
  // call_language / call_mode are baked into each agent's tool params, so
  // they're authoritative even if a webhook created the call record first.
  const fromTool = {
    ...(clean(args.call_language) && { language: toVoiceLang(args.call_language) }),
    ...(clean(args.call_mode) && { mode: clean(args.call_mode) }),
  };
  const executionId = clean(args.execution_id);
  if (executionId) {
    upsertCall(executionId, getCall(executionId) ? fromTool : { status: 'in-progress', ...agentLookup(clean(args.agent_id)), ...fromTool });
    return executionId;
  }
  const agentId = clean(args.agent_id);
  const live = listCalls(20).find((c) => c.source !== 'simulation' && !TERMINAL_STATUSES.has(c.status) && (!agentId || !c.agentId || c.agentId === agentId));
  if (live) {
    upsertCall(live.id, fromTool);
    return live.id;
  }
  const id = `live-${Date.now().toString(36)}`;
  upsertCall(id, { status: 'in-progress', language: toVoiceLang(args.call_language), mode: clean(args.call_mode) || 'intake' });
  return id;
}

function withTimeout(promise, ms, onTimeout) {
  return Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve(onTimeout()), ms))]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Mid-call tools — must answer fast; the caller is waiting on the line.
// ─────────────────────────────────────────────────────────────────────────────

export async function toolCheckEmergency(callId, args) {
  const symptoms = clean(args.symptoms) || '';
  pushEvent(callId, 'tool.call', { tool: 'check_emergency', args: { symptoms } });

  // The voice agent only calls this when it already heard something
  // alarming, so if triage can't answer within the budget we err on the side
  // of sending the caller to emergency care.
  const triage = await withTimeout(triageMessage(symptoms), 3500, () => ({
    is_emergency: true,
    urgency_level: 'urgent',
    detected_symptoms: [],
    timed_out: true,
  }));

  const result = {
    is_emergency: Boolean(triage.is_emergency),
    urgency_level: triage.urgency_level || (triage.is_emergency ? 'urgent' : 'none'),
    instruction: triage.is_emergency
      ? 'EMERGENCY. Tell the caller calmly to call 108 for an ambulance, or 112, or go to the nearest hospital emergency right now. Repeat the number once. Then end the call. Do not continue the interview.'
      : 'Not an emergency. Continue the interview normally.',
  };

  pushEvent(callId, 'tool.result', { tool: 'check_emergency', result });
  if (result.is_emergency) {
    upsertCall(callId, { emergency: true, emergencySymptoms: symptoms });
    pushEvent(callId, 'emergency', { symptoms, urgency: result.urgency_level });
  }
  return result;
}

export async function toolLookupMedicine(callId, args) {
  const spoken = clean(args.medicine_name) || '';
  pushEvent(callId, 'tool.call', { tool: 'lookup_medicine', args: { medicine_name: spoken } });

  const match = findDrug(spoken);
  let result;
  if (!match) {
    result = {
      found: false,
      instruction: 'Medicine not in the formulary. Ask the caller to spell it or read it from the strip, then continue. It is fine to file the report with the name as spoken.',
    };
  } else {
    const { drug } = match;
    const signals = await getDrugSignals(drug.name).catch(() => null);
    const alerts = alertsFor(drug.name).map((a) => `${a.alert_type} (${a.date}): ${a.summary}`);
    result = {
      found: true,
      generic_name: drug.name,
      matched_brand: match.kind === 'brand' ? match.matched : null,
      drug_class: drug.class,
      known_side_effects: drug.common_adrs,
      cdsco_safety_alerts: alerts,
      reports_on_pharmaco: signals?.totalReports || 0,
      instruction: `Confirm with the caller: "${match.kind === 'brand' ? `${match.matched}, that is ${drug.name}` : drug.name}". If their symptom matches a known side effect you may say it is a known effect and reporting it still helps. Do not give medical advice.`,
    };
  }

  pushEvent(callId, 'tool.result', { tool: 'lookup_medicine', result });
  upsertCall(callId, { medicine: result.generic_name || spoken });
  return result;
}

export async function toolFileReport(callId, args) {
  const call = getCall(callId) || upsertCall(callId);
  const lang = toVoiceLang(args.call_language || call.language);
  pushEvent(callId, 'tool.call', { tool: 'file_adr_report', args: Object.fromEntries(Object.entries(args).filter(([k, v]) => clean(v) && !['execution_id', 'agent_id', 'call_language', 'call_mode'].includes(k))) });

  // Idempotent: if the agent retries the tool, return the same reference.
  if (call.reportId) {
    const result = { report_id: call.reportId, spoken_reference: spokenRef(call.reportId), status: 'already_filed' };
    pushEvent(callId, 'tool.result', { tool: 'file_adr_report', result });
    return result;
  }

  const reportId = `PVP-${uuidv4().slice(0, 8).toUpperCase()}`;
  const extractedData = mergeExtractedData(null, toolArgsToExtracted(args, lang));
  const completeness = await assessCompleteness(extractedData);
  const conversationId = `voice-${callId}`;

  await saveConversation({
    id: conversationId,
    userId: call.ownerId || 'voice-line',
    messages: (call.transcript || []).map((t) => ({ role: t.role, content: t.text, timestamp: t.at, isVoice: true })),
    extractedData,
    language: VOICE_LANGUAGES[lang].bcp47,
    userType: extractedData.metadata.reporter_type === 'healthcare_professional' ? 'healthcare_professional' : 'patient',
    isAnonymous: true,
    status: 'report_ready',
    channel: 'voice',
    callId,
  });

  await saveReport({
    id: reportId,
    conversationId,
    userId: call.ownerId || 'voice-line',
    extractedData,
    completenessScore: completeness.completeness_score,
    status: 'submitted',
    isAnonymous: true,
    language: VOICE_LANGUAGES[lang].bcp47,
    channel: 'voice',
    callId,
    demo: call.source === 'simulation',
    title: extractedData.suspected_medicines[0]?.name || 'Voice report',
    reaction: extractedData.adverse_reactions[0]?.english_translation || null,
    emergency: Boolean(call.emergency),
  });

  upsertCall(callId, {
    reportId,
    conversationId,
    completenessBefore: completeness.completeness_score,
    completeness: completeness.completeness_score,
    medicine: extractedData.suspected_medicines[0]?.name || call.medicine,
    reaction: extractedData.adverse_reactions[0]?.english_translation || null,
  });

  const result = {
    report_id: reportId,
    spoken_reference: spokenRef(reportId),
    status: 'filed',
    instruction: `Tell the caller their report is filed and read the reference slowly: "${spokenRef(reportId)}". Thank them and say goodbye.`,
  };
  pushEvent(callId, 'tool.result', { tool: 'file_adr_report', result });
  pushEvent(callId, 'report.filed', { reportId, completeness: completeness.completeness_score, extractedData });

  // MedDRA coding + ICSR generation takes several seconds of LLM time — do it
  // after answering so the caller hears their reference immediately.
  enrichReport(callId, reportId).catch((err) => console.error('[Voice] enrichReport failed:', err.message));
  return result;
}

export async function toolUpdateReport(callId, args) {
  const reportId = clean(args.report_id) || getCall(callId)?.reportId;
  pushEvent(callId, 'tool.call', { tool: 'update_adr_report', args: Object.fromEntries(Object.entries(args).filter(([k, v]) => clean(v) && !['execution_id', 'agent_id', 'call_language', 'call_mode'].includes(k))) });

  const report = reportId ? await getReport(reportId) : null;
  if (!report) {
    const result = { status: 'not_found', instruction: 'Thank the caller; the team will review their answers. Say goodbye.' };
    pushEvent(callId, 'tool.result', { tool: 'update_adr_report', result });
    return result;
  }

  const lang = toVoiceLang(args.call_language || getCall(callId)?.language);
  const additions = toolArgsToExtracted({ ...args, medicine_name: args.medicine_name || report.extractedData?.suspected_medicines?.[0]?.name }, lang);
  // Follow-ups only fill gaps — they never overwrite what the original report said.
  const merged = fillGaps(report.extractedData || {}, additions);
  const completeness = await assessCompleteness(merged);
  const before = report.completenessScore ?? null;

  await saveReport({ ...report, extractedData: merged, completenessScore: completeness.completeness_score, followUpCallId: callId, updatedAt: new Date().toISOString() });
  if (report.conversationId) await updateConversation(report.conversationId, { extractedData: merged, completenessScore: completeness.completeness_score });

  upsertCall(callId, { reportId, completenessBefore: before, completeness: completeness.completeness_score, medicine: merged.suspected_medicines?.[0]?.name });
  const result = { status: 'updated', report_id: reportId, instruction: 'Thank the caller warmly for completing their report and say goodbye.' };
  pushEvent(callId, 'tool.result', { tool: 'update_adr_report', result });
  pushEvent(callId, 'report.updated', { reportId, completenessBefore: before, completeness: completeness.completeness_score, extractedData: merged });

  enrichReport(callId, reportId, { followUp: true }).catch((err) => console.error('[Voice] enrichReport failed:', err.message));
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Post-processing: MedDRA → WHO-UMC → ICSR, the same agents the web chat uses
// ─────────────────────────────────────────────────────────────────────────────

const enriching = new Map();

export function enrichReport(callId, reportId, { followUp = false } = {}) {
  // Coalesce: the file-report tool and the post-call webhook can both ask for
  // enrichment within seconds of each other.
  const key = `${reportId}:${followUp}`;
  if (enriching.has(key)) return enriching.get(key).then(() => runEnrichment(callId, reportId, { followUp }));
  const p = runEnrichment(callId, reportId, { followUp }).finally(() => enriching.delete(key));
  enriching.set(key, p);
  return p;
}

async function runEnrichment(callId, reportId, { followUp }) {
  const report = await getReport(reportId);
  if (!report) return;
  const extractedData = report.extractedData;

  pushEvent(callId, 'pipeline.step', { step: 'meddra', label: 'Coding reactions to MedDRA & assessing WHO-UMC causality' });
  const meddraData = await mapToMedDRA(extractedData);
  const pt = meddraData?.meddra_mappings?.map((m) => `${m.preferred_term} (${m.meddra_code})`).join(', ');
  pushEvent(callId, 'pipeline.step', {
    step: 'causality',
    label: `MedDRA: ${pt || '—'} · WHO-UMC: ${meddraData?.causality_assessment?.category || '—'}`,
    meddra: meddraData,
  });

  const completeness = await assessCompleteness(extractedData);
  pushEvent(callId, 'pipeline.step', { step: 'icsr', label: 'Generating CDSCO/PvPI ICSR' });
  const icsr = await generateICSR(extractedData, meddraData, completeness);
  icsr.report_id = reportId;
  icsr.report_type = followUp ? 'Follow-up' : 'Initial';
  icsr.source = 'Pharmaco Voice — phone call (Bolna · Sarvam)';
  if (report.emergency || getCall(callId)?.emergency) icsr.seriousness = 'Serious';

  const call = getCall(callId);
  const latest = (await getReport(reportId)) || report;
  // Enrichment can run twice (after the tool call, again after the webhook);
  // a report must only ever count once toward drug safety signals.
  const countSignals = !followUp && !latest.signalsCounted;
  await saveReport({
    ...latest,
    signalsCounted: latest.signalsCounted || countSignals,
    meddraMapping: meddraData,
    causality: meddraData?.causality_assessment,
    icsr,
    completenessScore: completeness.completeness_score,
    voiceCall: call
      ? {
          callId,
          durationSec: call.durationSec ?? null,
          recordingUrl: call.recordingUrl || null,
          language: call.language,
          caller: call.callerMasked || null,
          summary: call.summary || null,
        }
      : latest.voiceCall,
    updatedAt: new Date().toISOString(),
  });
  if (latest.conversationId) {
    await updateConversation(latest.conversationId, { meddraData, completenessScore: completeness.completeness_score, status: 'completed', reportId });
  }

  if (countSignals) {
    const adrTerms = meddraData?.meddra_mappings?.map((m) => m.preferred_term) || [];
    for (const med of extractedData.suspected_medicines || []) {
      if (med?.name) await updateDrugSignals(med.name, adrTerms).catch(() => {});
    }
  }

  upsertCall(callId, { completeness: completeness.completeness_score, causality: meddraData?.causality_assessment?.category, seriousness: icsr.seriousness, icsrReady: true });
  pushEvent(callId, 'pipeline.done', { reportId, icsr, completeness: completeness.completeness_score });
}

// ─────────────────────────────────────────────────────────────────────────────
// Post-call webhook — Bolna POSTs the execution payload on every status change
// ─────────────────────────────────────────────────────────────────────────────

export async function handleExecutionUpdate(payload) {
  const callId = payload.id || payload.execution_id;
  if (!callId) return { ignored: 'no execution id' };

  const status = payload.status || 'unknown';
  const existing = getCall(callId);
  const fromAgent = agentLookup(payload.agent_id);
  const callerNumber = payload.user_number || payload.telephony_data?.to_number || payload.telephony_data?.from_number;

  upsertCall(callId, {
    status,
    agentId: payload.agent_id || existing?.agentId,
    mode: existing?.mode || fromAgent.mode || 'intake',
    language: existing?.language || fromAgent.language || 'hi',
    direction: payload.telephony_data?.call_type || existing?.direction || null,
    callerMasked: existing?.callerMasked || maskPhone(callerNumber),
    durationSec: payload.conversation_duration ?? payload.telephony_data?.duration ?? existing?.durationSec ?? null,
    recordingUrl: payload.telephony_data?.recording_url || existing?.recordingUrl || null,
    summary: payload.summary || existing?.summary || null,
    costUsd: payload.total_cost ?? existing?.costUsd ?? null,
    terminationReason: payload.termination_reason || payload.telephony_data?.hangup_reason || null,
  });
  if (!existing || existing.status !== status) pushEvent(callId, 'call.status', { status });

  // Only `completed` carries the full transcript; `call-disconnected` arrives
  // first, half-populated, and must not trigger processing.
  if (status !== 'completed') {
    if (TERMINAL_STATUSES.has(status)) pushEvent(callId, 'call.ended', { status });
    return { callId, status };
  }

  const call = getCall(callId);
  if (call.processed) return { callId, status, duplicate: true };
  upsertCall(callId, { processed: true });

  await processCompletedCall(callId, parseTranscript(payload.transcript));
  return { callId, status, processed: true };
}

/** Turn a finished call's transcript into (or onto) a report. */
export async function processCompletedCall(callId, turns, { scriptedTranslations } = {}) {
  const call = getCall(callId);
  const lang = toVoiceLang(call.language);
  const bcp47 = VOICE_LANGUAGES[lang].bcp47;

  // Real calls only reach us as a whole transcript at the end — publish it
  // turn by turn (with a Sarvam Mayura English rendering of what the caller
  // said) so the console and the regulator see the full conversation.
  if (!call.transcript?.length && turns.length) {
    pushEvent(callId, 'pipeline.step', { step: 'transcript', label: `Sarvam Saaras transcript received · ${turns.length} turns` });
    const translated = await Promise.all(
      turns.map(async (t, i) => {
        if (t.role !== 'user' || lang === 'en') return null;
        if (scriptedTranslations?.[i]) return scriptedTranslations[i];
        const en = await translateText(t.text, bcp47, 'en-IN').catch(() => t.text);
        return en && en !== t.text ? en : null;
      })
    );
    turns.forEach((t, i) => pushEvent(callId, 'transcript.turn', { role: t.role, text: t.text, text_en: translated[i] }));
  }

  const history = turns.map((t) => ({ role: t.role, content: t.text }));
  if (!history.length) {
    pushEvent(callId, 'call.ended', { status: 'completed', note: 'Empty transcript' });
    return;
  }

  if (call.emergency && !call.reportId) {
    // The agent correctly cut the interview short. Still file what we know —
    // a serious ADR is exactly what PvPI must hear about.
    pushEvent(callId, 'pipeline.step', { step: 'emergency', label: 'Emergency call — filing as SERIOUS for expedited review' });
  }

  pushEvent(callId, 'pipeline.step', { step: 'extract', label: 'Extraction agent reading the full call' });
  const extraction = await extractFromConversation(history);

  const fresh = getCall(callId);
  if (fresh.emergency) {
    // Never lose an emergency for want of an LLM: fall back to what the
    // triage tool was told on the line.
    if (!extraction.adverse_reactions?.length && fresh.emergencySymptoms) {
      extraction.adverse_reactions = [{ original_text: fresh.emergencySymptoms, english_translation: fresh.emergencySymptoms, severity: 'severe', still_ongoing: true }];
    }
    extraction.adverse_reactions = (extraction.adverse_reactions || []).map((r) => ({ ...r, severity: 'severe' }));
  }
  if (!extraction.suspected_medicines?.[0]?.name) {
    const spoken = findDrugInText(turns.filter((t) => t.role === 'user').map((t) => t.text).join(' '));
    if (spoken) {
      extraction.suspected_medicines = [{ name: spoken.drug.name, brand_name: spoken.kind === 'brand' ? spoken.matched : null, confidence: 0.8 }];
    }
  }
  if (fresh.reportId) {
    const report = await getReport(fresh.reportId);
    if (report) {
      // Caller-confirmed tool data wins; the transcript fills whatever the
      // agent didn't pass in the tool call.
      const merged = fillGaps(report.extractedData || {}, extraction);
      const completeness = await assessCompleteness(merged);
      await saveReport({ ...report, extractedData: merged, completenessScore: completeness.completeness_score });
      if (report.conversationId) {
        await updateConversation(report.conversationId, {
          messages: turns.map((t) => ({ role: t.role, content: t.text, isVoice: true, timestamp: new Date().toISOString() })),
          extractedData: merged,
        });
      }
      upsertCall(callId, { completeness: completeness.completeness_score });
      pushEvent(callId, 'pipeline.step', { step: 'extracted', label: `Transcript reconciled with filed report · completeness ${completeness.completeness_score}%`, extractedData: merged });
      await enrichReport(callId, fresh.reportId, { followUp: fresh.mode === 'followup' });
      pushEvent(callId, 'call.ended', { status: 'completed' });
      return;
    }
  }

  // No report was filed during the call (caller hung up early, the tool
  // failed, or it was an emergency). Recover one from the transcript if it
  // has the minimum a regulator needs.
  const hasMinimum = extraction?.suspected_medicines?.[0]?.name && extraction?.adverse_reactions?.length;
  if (!hasMinimum && !fresh.emergency) {
    upsertCall(callId, { outcome: 'no_report' });
    pushEvent(callId, 'call.ended', { status: 'completed', note: 'Not enough information for a report' });
    return;
  }

  const reportId = `PVP-${uuidv4().slice(0, 8).toUpperCase()}`;
  const extractedData = mergeExtractedData(null, extraction);
  extractedData.metadata.language_detected = bcp47;
  const completeness = await assessCompleteness(extractedData);
  const conversationId = `voice-${callId}`;

  await saveConversation({
    id: conversationId,
    userId: fresh.ownerId || 'voice-line',
    messages: turns.map((t) => ({ role: t.role, content: t.text, isVoice: true, timestamp: new Date().toISOString() })),
    extractedData,
    language: bcp47,
    userType: 'patient',
    isAnonymous: true,
    status: 'report_ready',
    channel: 'voice',
    callId,
  });
  await saveReport({
    id: reportId,
    conversationId,
    userId: fresh.ownerId || 'voice-line',
    extractedData,
    completenessScore: completeness.completeness_score,
    status: 'submitted',
    isAnonymous: true,
    language: bcp47,
    channel: 'voice',
    callId,
    demo: fresh.source === 'simulation',
    emergency: Boolean(fresh.emergency),
    title: extractedData.suspected_medicines?.[0]?.name || 'Voice report',
    reaction: extractedData.adverse_reactions?.[0]?.english_translation || null,
  });
  upsertCall(callId, { reportId, conversationId, completenessBefore: completeness.completeness_score, completeness: completeness.completeness_score, recoveredFromTranscript: true });
  pushEvent(callId, 'report.filed', { reportId, completeness: completeness.completeness_score, extractedData, recovered: true });
  await enrichReport(callId, reportId);
  pushEvent(callId, 'call.ended', { status: 'completed' });
}
