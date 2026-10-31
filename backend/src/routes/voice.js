import express from 'express';
import { isBolnaConfigured, resolveAgentId, getAgentRegistry, placeCall, getExecution, createWebCallSession } from '../services/bolnaService.js';
import { isSarvamConfigured, textToSpeech } from '../services/sarvamService.js';
import { getReport, getAllReports } from '../services/firebaseService.js';
import { assessCompleteness } from '../agents/completenessAgent.js';
import { voiceConfig } from '../voice/agentBlueprint.js';
import { VOICE_LANGUAGES, toVoiceLang } from '../voice/languages.js';
import { voiceBus, getCall, listCalls, upsertCall, pushEvent, summarize, maskPhone } from '../voice/voiceStore.js';
import {
  resolveCallId, toolCheckEmergency, toolLookupMedicine, toolFileReport, toolUpdateReport,
  handleExecutionUpdate, spokenRef,
} from '../voice/callPipeline.js';
import { listScenarios, startScenario } from '../voice/demoScenarios.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// Auth for Bolna → Pharmaco requests (tools + webhook). Bolna sends the
// tool's api_token as the Authorization header; the webhook URL carries ?key=.
// ─────────────────────────────────────────────────────────────────────────────
function requireVoiceKey(req, res, next) {
  const { toolSecret } = voiceConfig();
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const provided = bearer || req.headers['x-pharmaco-voice-key'] || req.query.key;
  if (provided === toolSecret) return next();
  console.warn(`[Voice] rejected unauthenticated request to ${req.path}`);
  return res.status(401).json({ error: 'unauthorized' });
}

function toolArgs(req) {
  return { ...req.query, ...(req.body && typeof req.body === 'object' ? req.body : {}) };
}

/** Wrap a tool so a backend failure never leaves the caller in dead air. */
function toolRoute(handler) {
  return async (req, res) => {
    const args = toolArgs(req);
    try {
      const callId = resolveCallId(args);
      res.json(await handler(callId, args));
    } catch (error) {
      console.error(`[Voice tool] ${req.path} failed:`, error);
      res.json({ status: 'error', instruction: 'There was a small technical problem. Apologise briefly and continue the conversation.' });
    }
  };
}

/** Normalise Indian numbers to E.164 — "98450 12345" → "+919845012345". */
function toE164(phone) {
  const digits = String(phone || '').replace(/[^\d+]/g, '');
  if (/^\+\d{10,15}$/.test(digits)) return digits;
  const bare = digits.replace(/^\+/, '');
  if (/^[6-9]\d{9}$/.test(bare)) return `+91${bare}`;
  if (/^0[6-9]\d{9}$/.test(bare)) return `+91${bare.slice(1)}`;
  if (/^91[6-9]\d{9}$/.test(bare)) return `+${bare}`;
  return null;
}

const MISSING_FIELD_QUESTIONS = {
  age_group: "the patient's age",
  gender: 'whether the patient is male or female',
  onset_date: 'when the problem started after taking the medicine',
  outcome: 'how the patient is feeling now',
  dosage: 'the dose (how many mg)',
  frequency: 'how many times a day it is taken',
  medical_history: 'any other illnesses the patient has',
  concomitant_medications: 'any other medicines taken regularly',
  causality_signals_present: 'whether the problem got better after the medicine was stopped',
};

// ─────────────────────────────────────────────────────────────────────────────
// Status
// ─────────────────────────────────────────────────────────────────────────────
router.get('/status', (req, res) => {
  const cfg = voiceConfig();
  const registry = getAgentRegistry();
  res.json({
    bolna: { configured: isBolnaConfigured(), agents: registry, agentCount: Object.keys(registry).length },
    sarvam: { configured: isSarvamConfigured(), stt: cfg.sttModel, tts: cfg.ttsModel, voice: cfg.ttsVoiceName },
    publicBaseUrl: cfg.publicBaseUrl || null,
    inboundNumber: process.env.BOLNA_INBOUND_NUMBER || null,
    llm: `${cfg.llmProvider}/${cfg.llmModel}`,
    languages: Object.values(VOICE_LANGUAGES).map(({ code, name, native }) => ({
      code, name, native, intake: Boolean(registry[`intake:${code}`]), followup: Boolean(registry[`followup:${code}`]),
    })),
    liveReady: isBolnaConfigured() && Object.keys(registry).length > 0,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Bolna custom-function tools (called mid-call)
// ─────────────────────────────────────────────────────────────────────────────
router.all('/tools/check-emergency', requireVoiceKey, toolRoute(toolCheckEmergency));
router.all('/tools/lookup-medicine', requireVoiceKey, toolRoute(toolLookupMedicine));
router.all('/tools/file-report', requireVoiceKey, toolRoute(toolFileReport));
router.all('/tools/update-report', requireVoiceKey, toolRoute(toolUpdateReport));

// ─────────────────────────────────────────────────────────────────────────────
// Bolna execution webhook — POSTed on every status change of every call
// ─────────────────────────────────────────────────────────────────────────────
router.post('/webhook', requireVoiceKey, async (req, res) => {
  // Acknowledge immediately; processing a completed call takes LLM time.
  res.json({ received: true });
  try {
    await handleExecutionUpdate(req.body || {});
  } catch (error) {
    console.error('[Voice webhook] processing failed:', error);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Outbound calls: "call me" (intake) and AI follow-up on an incomplete report
// ─────────────────────────────────────────────────────────────────────────────

// Webhooks can't reach a laptop without a tunnel, so after placing a call we
// also poll Bolna for its execution until it reaches a final state.
function pollExecution(executionId, attempt = 0) {
  if (attempt > 120) return;
  setTimeout(async () => {
    try {
      const execution = await getExecution(executionId);
      const result = await handleExecutionUpdate({ ...execution, id: executionId });
      if (['completed', 'no-answer', 'busy', 'failed', 'canceled', 'stopped', 'error', 'balance-low'].includes(execution.status) || result?.duplicate) return;
    } catch (error) {
      console.warn('[Voice] execution poll failed:', error.message);
    }
    pollExecution(executionId, attempt + 1);
  }, 5000);
}

router.post('/call', async (req, res) => {
  try {
    const { phone, language, mode = 'intake', reportId, consent } = req.body || {};
    const e164 = toE164(phone);
    if (!e164) return res.status(400).json({ error: 'Please enter a valid Indian mobile number.' });
    // Follow-up calls are opt-in only: the default follow-up path is in the
    // chat itself. A phone call requires the reporter's explicit consent.
    if (mode === 'followup' && consent !== true) {
      return res.status(400).json({ error: 'A follow-up call needs the reporter’s explicit consent.', code: 'consent_required' });
    }
    if (!isBolnaConfigured()) return res.status(503).json({ error: 'Live calling is not configured yet (BOLNA_API_KEY missing). Use a demo call instead.', code: 'bolna_not_configured' });

    const lang = toVoiceLang(language);
    const agentMode = mode === 'followup' ? 'followup' : 'intake';
    const agentId = resolveAgentId(agentMode, lang);
    if (!agentId) return res.status(503).json({ error: `No ${agentMode} agent set up — run "npm run bolna:setup".`, code: 'agent_missing' });

    let userData = { caller_language: VOICE_LANGUAGES[lang].name };
    let completenessBefore = null;
    if (agentMode === 'followup') {
      const report = reportId ? await getReport(reportId) : null;
      if (!report) return res.status(404).json({ error: 'Report not found for follow-up.' });
      const completeness = await assessCompleteness(report.extractedData);
      completenessBefore = completeness.completeness_score;
      const missing = completeness.missing_fields.map((f) => MISSING_FIELD_QUESTIONS[f]).filter(Boolean);
      userData = {
        ...userData,
        report_id: report.id,
        report_ref: spokenRef(report.id),
        medicine_name: report.extractedData?.suspected_medicines?.[0]?.name || 'the medicine',
        reaction_summary: report.extractedData?.adverse_reactions?.[0]?.english_translation || report.reaction || 'a side effect',
        missing_fields: missing.length ? missing.join('; ') : 'nothing essential — just confirm how they are now',
      };
    }

    const result = await placeCall({ agentId, phone: e164, userData });
    const executionId = result.execution_id;
    upsertCall(executionId, {
      source: 'bolna',
      status: result.status || 'queued',
      mode: agentMode,
      language: lang,
      agentId,
      direction: 'outbound',
      callerMasked: maskPhone(e164),
      ownerId: req.user?.uid !== 'anonymous' ? req.user?.uid : undefined,
      reportId: agentMode === 'followup' ? reportId : undefined,
      completenessBefore,
      consentRecordedAt: agentMode === 'followup' ? new Date().toISOString() : undefined,
    });
    pushEvent(executionId, 'call.status', { status: result.status || 'queued' });
    pollExecution(executionId);
    res.json({ callId: executionId, status: result.status });
  } catch (error) {
    console.error('[POST /voice/call]', error);
    res.status(502).json({ error: error.message });
  }
});

/** Mint a single-use Bolna web-call session (the bn- key never reaches the browser). */
router.post('/web-session', async (req, res) => {
  try {
    if (!isBolnaConfigured()) return res.status(503).json({ error: 'Live calling is not configured yet.', code: 'bolna_not_configured' });
    const lang = toVoiceLang(req.body?.language || req.body?.user_data?.language);
    const agentId = resolveAgentId('intake', lang);
    if (!agentId) return res.status(503).json({ error: 'No intake agent set up — run "npm run bolna:setup".', code: 'agent_missing' });
    const session = await createWebCallSession({ agentId, userData: { ...(req.body?.user_data || {}), channel: 'web-call' } });
    res.json(session);
  } catch (error) {
    console.error('[POST /voice/web-session]', error);
    res.status(502).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Call console data
// ─────────────────────────────────────────────────────────────────────────────
router.get('/calls', (req, res) => {
  res.json({ calls: listCalls(Number(req.query.limit) || 30).map(summarize) });
});

router.get('/calls/:id', async (req, res) => {
  const call = getCall(req.params.id);
  if (!call) return res.status(404).json({ error: 'Call not found' });
  const report = call.reportId ? await getReport(call.reportId) : null;
  res.json({ call, report });
});

/** Manual re-sync with Bolna — useful if a webhook was missed. */
router.post('/calls/:id/sync', async (req, res) => {
  try {
    const execution = await getExecution(req.params.id);
    res.json(await handleExecutionUpdate({ ...execution, id: req.params.id }));
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

/** Server-sent events: every transcript turn, tool call and pipeline step, live. */
router.get('/events', (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders?.();
  res.write(': connected\n\n');

  const only = req.query.callId;
  const onEvent = (event) => {
    if (only && event.callId !== only) return;
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };
  voiceBus.on('event', onEvent);
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 20000);
  req.on('close', () => {
    clearInterval(heartbeat);
    voiceBus.off('event', onEvent);
  });
});

/** Reports most in need of a follow-up call, least complete first. */
router.get('/followup-queue', async (req, res) => {
  try {
    const reports = await getAllReports(200);
    const queue = [];
    for (const r of reports) {
      if (r.status === 'draft' || !r.extractedData) continue;
      const c = await assessCompleteness(r.extractedData);
      if (c.completeness_score >= 85) continue;
      queue.push({
        id: r.id,
        medicine: r.extractedData?.suspected_medicines?.[0]?.name || r.title || 'Unknown medicine',
        reaction: r.extractedData?.adverse_reactions?.[0]?.english_translation || r.reaction || null,
        completeness: c.completeness_score,
        missing: c.missing_fields.filter((f) => MISSING_FIELD_QUESTIONS[f]).map((f) => MISSING_FIELD_QUESTIONS[f]),
        channel: r.channel || 'web',
        language: r.language || null,
        createdAt: r.createdAt,
      });
    }
    queue.sort((a, b) => a.completeness - b.completeness);
    res.json({ queue: queue.slice(0, 20) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Demo calls + Sarvam TTS for the console
// ─────────────────────────────────────────────────────────────────────────────
router.get('/scenarios', (req, res) => res.json({ scenarios: listScenarios() }));

router.post('/simulate', async (req, res) => {
  try {
    const { scenarioId = 'hi-metformin', speed = 1 } = req.body || {};
    const callId = await startScenario(scenarioId, { speed, ownerId: req.user?.uid !== 'anonymous' ? req.user?.uid : undefined });
    res.json({ callId });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/tts', async (req, res) => {
  const { text, language = 'hi' } = req.body || {};
  if (!text) return res.status(400).json({ error: 'text is required' });
  const audio = await textToSpeech(text, VOICE_LANGUAGES[toVoiceLang(language)].bcp47);
  if (!audio) return res.status(503).json({ error: 'Sarvam TTS unavailable', code: 'sarvam_not_configured' });
  res.json({ audio, format: 'wav' });
});

export default router;
