import { v4 as uuidv4 } from 'uuid';
import { getNextMessage, meetsReportMinimum } from '../agents/conversationAgent.js';
import { extractFromConversation } from '../agents/extractionAgent.js';
import { mapToMedDRA } from '../agents/mappingAgent.js';
import { assessCompleteness } from '../agents/completenessAgent.js';
import { triageMessage, mergeTriageState } from '../agents/triageAgent.js';
import { getConversation, updateConversation } from './firebaseService.js';
import { translateText } from './sarvamService.js';
import { callGroq } from './nebiusService.js';
import { mergeExtractedData, mergeNewFields } from '../utils/extractedData.js';
import { annotateMedicines } from '../utils/medicineMatch.js';
import { emergencyMessage, fallbackMessage, resolveLanguage } from '../utils/languageSupport.js';

// ─────────────────────────────────────────────────────────────────────────────
// One conversation turn, shared by typed messages and voice. Typing and voice
// therefore take exactly the same path: same language handling, same triage,
// same history, same timestamps.
// ─────────────────────────────────────────────────────────────────────────────

// ── Message identity & ordering ──────────────────────────────────────────────
// Every message is created on the server (one clock), in UTC ISO-8601, with a
// stable id and a monotonically increasing `seq`. Clients render by `seq`, so
// message order never depends on client clocks, timezones, or the order in
// which async responses happen to arrive.

/** A UTC timestamp strictly later than `prevIso`, even within the same millisecond. */
export function nextTimestamp(prevIso) {
  const now = Date.now();
  const prev = prevIso ? Date.parse(prevIso) : NaN;
  return new Date(Number.isFinite(prev) && prev >= now ? prev + 1 : now).toISOString();
}

/** Give legacy messages an id/seq/timestamp and return them in creation order. */
export function normalizeMessages(messages) {
  const list = Array.isArray(messages) ? messages : [];
  const out = list.map((m, i) => ({
    ...m,
    id: m.id || uuidv4(),
    seq: Number.isInteger(m.seq) ? m.seq : i,
  }));
  return out.sort((a, b) => a.seq - b.seq);
}

export function stampMessage(history, fields) {
  const last = history[history.length - 1];
  return {
    id: uuidv4(),
    seq: last ? last.seq + 1 : 0,
    timestamp: nextTimestamp(last?.timestamp),
    ...fields,
  };
}

// ── Per-conversation serialisation ───────────────────────────────────────────
// Two overlapping requests for the same conversation (a double-tap, or a voice
// transcript landing while a typed reply is still being generated) would
// otherwise both read the same history and overwrite each other. Turns for one
// conversation run strictly one after another, in arrival order.
const locks = new Map();

export function withConversationLock(conversationId, fn) {
  const prev = locks.get(conversationId) || Promise.resolve();
  const run = prev.catch(() => {}).then(fn);
  const tail = run.catch(() => {});
  locks.set(conversationId, tail);
  tail.then(() => { if (locks.get(conversationId) === tail) locks.delete(conversationId); });
  return run;
}

const publicTriage = (t) => ({
  status: t.triage_status,
  is_emergency: t.is_emergency,
  red_flags: t.red_flags,
  source: t.source,
});

/**
 * Process one patient message and persist the result.
 * `deps` lets tests substitute the LLM and the datastore; production uses the defaults.
 */
export async function processUserTurn({ conversation, message, userType, language, inputMode }, deps = {}) {
  const {
    llm = callGroq,
    translate = translateText,
    extract = extractFromConversation,
    mapMedDRA = mapToMedDRA,
    assess = assessCompleteness,
    update = updateConversation,
  } = deps;

  const conversationId = conversation.id;
  // The conversation language is explicit state set by the user's language
  // choice — never inferred from the text of a message.
  const lang = resolveLanguage(language, conversation.language);
  if (lang !== conversation.language) await update(conversationId, { language: lang });

  const history = normalizeMessages(conversation.messages);
  const userMsg = stampMessage(history, { role: 'user', content: message, ...(inputMode === 'voice' && { isVoice: true }) });
  const withUser = [...history, userMsg];
  const turnBase = { language: lang };

  // 1. Safety triage on every message, in context of the recent conversation.
  const triage = await triageMessage(message, { language: lang, history: withUser, llm });
  const triageState = mergeTriageState(conversation.triage, triage);

  const escalate = async (reasonTriage) => {
    const advice = emergencyMessage(lang);
    const botMsg = stampMessage(withUser, { role: 'assistant', content: advice, isEmergency: true });
    await update(conversationId, { messages: [...withUser, botMsg], triage: triageState });
    return {
      ...turnBase,
      message: advice,
      isEmergency: true,
      isReportReady: false,
      triage: publicTriage(reasonTriage),
      userMessage: userMsg,
      assistantMessage: botMsg,
    };
  };

  if (triage.is_emergency) return escalate(triage);

  // 2. Fresh structured extraction from the full history.
  let extractedData = conversation.extractedData || null;
  try {
    const fresh = await extract(withUser.map((m) => ({ role: m.role, content: m.content })));
    extractedData = mergeExtractedData(extractedData, fresh);
  } catch (err) {
    console.error('[Extraction] error:', err.message);
    // Keep previously extracted data — never abort the conversation.
  }

  // 3. Next conversational reply, with the selected language and triage state.
  const agent = await getNextMessage(
    withUser.map((m) => ({ role: m.role, content: m.content })),
    userType || conversation.userType,
    lang,
    extractedData,
    { triage: triageState, llm, translate },
  );

  // The conversation model may escalate only when triage could not rule an
  // emergency out. If triage looked at the message and found no red flag, the
  // model cannot override that (this is what stops over-triggering).
  if (agent.isEmergency && triage.triage_status !== 'non_emergency') return escalate({ ...triage, triage_status: 'emergency', is_emergency: true, source: 'conversation_model' });

  if (agent.newFields && Object.keys(agent.newFields).length > 0) {
    extractedData = mergeNewFields(extractedData, agent.newFields);
  }
  extractedData = annotateMedicines(extractedData);

  const botMsg = stampMessage(withUser, { role: 'assistant', content: agent.message });
  const finalMessages = [...withUser, botMsg];

  // 4. Report readiness: the model proposes, the server verifies the required fields.
  const alreadyReady = conversation.status === 'report_ready';
  const proposedReady = agent.isReportReady && meetsReportMinimum(extractedData);

  let completenessScore = null;
  let meddraData = null;
  if (proposedReady || alreadyReady) {
    // Once a conversation has reached report_ready, keep the MedDRA mapping and
    // completeness in sync with every later correction.
    try {
      const fullExtraction = await extract(finalMessages.map((m) => ({ role: m.role, content: m.content })));
      extractedData = annotateMedicines(mergeExtractedData(extractedData, fullExtraction));
      meddraData = await mapMedDRA(extractedData);
      completenessScore = (await assess(extractedData)).completeness_score;
      await update(conversationId, { messages: finalMessages, extractedData, meddraData, completenessScore, status: 'report_ready', triage: triageState });
    } catch (err) {
      console.error('[Report pipeline] error:', err.message);
      await update(conversationId, { messages: finalMessages, extractedData, triage: triageState });
    }
  } else {
    await update(conversationId, { messages: finalMessages, extractedData, triage: triageState });
  }

  return {
    ...turnBase,
    message: agent.message,
    isEmergency: false,
    isReportReady: proposedReady || alreadyReady,
    extractedData,
    meddraData,
    completenessScore,
    triage: publicTriage(triage),
    userMessage: userMsg,
    assistantMessage: botMsg,
  };
}

export { getConversation, fallbackMessage };
