import express from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { extractFromConversation } from '../agents/extractionAgent.js';
import { mapToMedDRA } from '../agents/mappingAgent.js';
import { assessCompleteness } from '../agents/completenessAgent.js';
import { generateICSR } from '../agents/reportAgent.js';
import { saveConversation, updateConversation, getConversation, saveReport, updateDrugSignals, getReportsByConversationId } from '../services/firebaseService.js';
import { transcribeWithSarvam, isSarvamConfigured } from '../services/sarvamService.js';
import { processUserTurn, withConversationLock, normalizeMessages, stampMessage } from '../services/conversationTurn.js';
import { fallbackMessage, normalizeLanguage, resolveLanguage } from '../utils/languageSupport.js';
import { WELCOME_MESSAGES } from '../prompts/conversationPrompts.js';
import { mergeExtractedData } from '../utils/extractedData.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/conversation/start
// ─────────────────────────────────────────────────────────────────────────────
router.post('/start', async (req, res) => {
  try {
    const { userType = 'patient', isAnonymous = true } = req.body;
    // Explicit conversation language; unknown values fall back to Hindi, the app default.
    const language = resolveLanguage(req.body.language, 'hi-IN');

    const welcomeText = WELCOME_MESSAGES[language] || WELCOME_MESSAGES['en-IN'];
    const welcome = stampMessage([], { role: 'assistant', content: welcomeText });
    const conversationId = uuidv4();

    await saveConversation({
      id: conversationId,
      userId: req.user?.uid || 'anonymous',
      messages: [welcome],
      extractedData: null,
      language,
      userType,
      isAnonymous,
      status: 'active',
    });
    res.json({ conversationId, welcomeMessage: welcomeText, welcome, language, userType });
  } catch (error) {
    console.error('[POST /start]', error);
    res.status(500).json({ error: 'Failed to start conversation', message: error.message });
  }
});

// Runs one patient turn under the per-conversation lock so concurrent requests
// are processed in arrival order and can never overwrite each other's history.
async function handleTurn({ conversationId, message, userType, language, inputMode }) {
  return withConversationLock(conversationId, async () => {
    const conversation = await getConversation(conversationId);
    if (!conversation) return { status: 404 };
    return { status: 200, body: await processUserTurn({ conversation, message, userType, language, inputMode }) };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/conversation/message
// ─────────────────────────────────────────────────────────────────────────────
router.post('/message', async (req, res) => {
  const { conversationId, message, userType = 'patient', language, inputMode } = req.body;
  if (!conversationId || !message) {
    return res.status(400).json({ error: 'conversationId and message are required' });
  }
  try {
    const out = await handleTurn({ conversationId, message, userType, language, inputMode });
    if (out.status === 404) return res.status(404).json({ error: 'Conversation not found' });
    res.json(out.body);
  } catch (error) {
    console.error('[POST /message]', error);
    // Friendly error in the patient's language — do NOT restart the conversation.
    res.status(500).json({
      message: fallbackMessage(resolveLanguage(language)),
      isEmergency: false,
      isReportReady: false,
      error: error.message,
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/conversation/:conversationId/language
// The user picked a different language in the selector. Persist it now so every
// later reply, advisory and voice playback uses it. If the patient has not said
// anything yet, the welcome message is re-written in the new language too;
// once they have, earlier messages are history and are left as they are.
// ─────────────────────────────────────────────────────────────────────────────
router.put('/:conversationId/language', async (req, res) => {
  const { conversationId } = req.params;
  const language = normalizeLanguage(req.body?.language);
  if (!language) return res.status(400).json({ error: 'A supported language is required' });
  try {
    const out = await withConversationLock(conversationId, async () => {
      const conversation = await getConversation(conversationId);
      if (!conversation) return { status: 404 };
      const owner = conversation.userId;
      if (owner && owner !== 'anonymous' && owner !== 'voice-line' && owner !== req.user?.uid) return { status: 404 };

      const messages = normalizeMessages(conversation.messages);
      const untouched = !messages.some((m) => m.role === 'user');
      let welcome = null;
      let nextMessages = messages;
      if (untouched && messages[0]?.role === 'assistant') {
        welcome = { ...messages[0], content: WELCOME_MESSAGES[language] || WELCOME_MESSAGES['en-IN'] };
        nextMessages = [welcome, ...messages.slice(1)];
      }
      await updateConversation(conversationId, { language, ...(welcome && { messages: nextMessages }) });
      return { status: 200, body: { language, welcome } };
    });
    if (out.status === 404) return res.status(404).json({ error: 'Conversation not found' });
    res.json(out.body);
  } catch (error) {
    console.error('[PUT /:conversationId/language]', error);
    res.status(500).json({ error: 'Failed to change language', message: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/conversation/transcribe
// Speech-to-text ONLY. The chat composer shows the transcript for the user to
// review and edit before anything is sent, so this never sends a message and
// never substitutes a mock transcript — if Sarvam can't transcribe, the
// client is told so and falls back to browser speech recognition or typing.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/transcribe', upload.single('audio'), async (req, res) => {
  const audioBuffer = req.file?.buffer;
  if (!audioBuffer?.length) return res.status(400).json({ error: 'No audio received.', code: 'no_audio' });
  if (!isSarvamConfigured()) {
    return res.status(503).json({ error: 'Voice transcription is not available on this server.', code: 'stt_not_configured' });
  }
  const language = req.body?.language || 'hi-IN';
  try {
    const result = await transcribeWithSarvam(audioBuffer, language, req.file.mimetype);
    if (!result.transcript.trim()) {
      return res.status(422).json({ error: "We couldn't make out any words. Please try again a little closer to the microphone.", code: 'empty_transcript' });
    }
    res.json({ transcript: result.transcript.trim(), language: result.language_detected, engine: 'sarvam', model: result.model });
  } catch (error) {
    console.error('[POST /transcribe]', error.response?.data || error.message);
    res.status(502).json({ error: 'Voice transcription failed. Please try again or type instead.', code: 'stt_failed' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/conversation/voice  (transcribe + send in one step)
// Same turn pipeline as typed messages. Uses real Sarvam transcription only —
// a canned transcript is never passed off as what the patient said.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/voice', upload.single('audio'), async (req, res) => {
  const { conversationId } = req.body;
  const audioBuffer = req.file?.buffer;
  if (!audioBuffer?.length) return res.status(400).json({ error: 'No audio file provided', code: 'no_audio' });
  if (!isSarvamConfigured()) {
    return res.status(503).json({ error: 'Voice transcription is not available on this server.', code: 'stt_not_configured' });
  }
  try {
    const existing = await getConversation(conversationId);
    if (!existing) return res.status(404).json({ error: 'Conversation not found' });
    // Transcribe in the conversation's language unless the client explicitly selected another.
    const language = resolveLanguage(req.body.language, existing.language);

    const transcription = await transcribeWithSarvam(audioBuffer, language, req.file.mimetype);
    const transcript = transcription.transcript.trim();
    if (!transcript) {
      return res.status(422).json({ error: 'Could not transcribe audio. Please try speaking more clearly.', code: 'empty_transcript' });
    }

    const out = await handleTurn({ conversationId, message: transcript, userType: existing.userType, language, inputMode: 'voice' });
    if (out.status === 404) return res.status(404).json({ error: 'Conversation not found' });
    res.json({ transcript, languageDetected: transcription.language_detected, ...out.body });
  } catch (error) {
    console.error('[POST /voice]', error.response?.data || error);
    res.status(500).json({ error: 'Voice processing failed', message: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/conversation/end
// ─────────────────────────────────────────────────────────────────────────────
router.post('/end', async (req, res) => {
  try {
    const { conversationId } = req.body;
    const conversation = await getConversation(conversationId);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

    const history = conversation.messages.map(m => ({ role: m.role, content: m.content }));

    const extractedData = mergeExtractedData(conversation.extractedData || null, await extractFromConversation(history));
    const meddraData = await mapToMedDRA(extractedData);
    const completeness = await assessCompleteness(extractedData);
    const icsr = await generateICSR(extractedData, meddraData, completeness);

    // Reuse the existing draft's report id (if one exists for this
    // conversation) instead of always minting a new one — otherwise
    // submitting leaves an orphaned duplicate "draft" document behind
    // for the same report, and My Reports shows it twice.
    const existingReports = await getReportsByConversationId(conversationId, 20);
    const existingDraft = existingReports.find((r) => r.status === 'draft');
    if (existingDraft) icsr.report_id = existingDraft.id;

    const reportId = await saveReport({
      id: icsr.report_id,
      conversationId,
      userId: conversation.userId,
      extractedData,
      meddraMapping: meddraData,
      causality: meddraData?.causality_assessment,
      icsr,
      completenessScore: completeness.completeness_score,
      status: 'submitted',
      isAnonymous: conversation.isAnonymous,
      createdAt: existingDraft?.createdAt,
    });

    const drugNames = extractedData.suspected_medicines?.map(m => m.name) || [];
    const adrTerms = meddraData?.meddra_mappings?.map(m => m.preferred_term) || [];
    for (const drug of drugNames) {
      await updateDrugSignals(drug, adrTerms);
    }

    await updateConversation(conversationId, { status: 'completed', reportId });
    res.json({ reportId, report: icsr, completenessScore: completeness.completeness_score });
  } catch (error) {
    console.error('[POST /end]', error);
    res.status(500).json({ error: 'Failed to generate report', message: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/conversation/:conversationId/fields
// Inline correction — the user directly edits a field on the Review screen
// instead of re-chatting. This is the single write path for manual edits so
// the conversation doc (source of truth), its MedDRA mapping/completeness,
// and any existing draft report snapshot all stay in sync.
// ─────────────────────────────────────────────────────────────────────────────
router.put('/:conversationId/fields', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { extractedData } = req.body;

    if (!extractedData) {
      return res.status(400).json({ error: 'extractedData is required' });
    }

    const conversation = await getConversation(conversationId);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

    // Normalize through the same merge helper used elsewhere so the shape
    // is always consistent — merge onto an empty base rather than trusting
    // the client's shape directly.
    const normalized = mergeExtractedData(null, extractedData);
    const meddraData = await mapToMedDRA(normalized);
    const completeness = await assessCompleteness(normalized);

    await updateConversation(conversationId, {
      extractedData: normalized,
      meddraData,
      completenessScore: completeness.completeness_score,
    });

    // Keep an existing draft report snapshot canonical too.
    const existingReports = await getReportsByConversationId(conversationId, 20);
    const existingDraft = existingReports.find((r) => r.status === 'draft');
    if (existingDraft) {
      await saveReport({
        ...existingDraft,
        extractedData: normalized,
        completenessScore: completeness.completeness_score,
        title: normalized.suspected_medicines?.[0]?.name || existingDraft.title,
        reaction: normalized.adverse_reactions?.[0]?.original_text || existingDraft.reaction,
      });
    }

    res.json({ extractedData: normalized, meddraData, completenessScore: completeness.completeness_score });
  } catch (error) {
    console.error('[PUT /:conversationId/fields]', error);
    res.status(500).json({ error: 'Failed to save your edits', message: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/conversation/:conversationId/generate-draft
// Generates a professional ICSR draft from the canonical structured state
// WITHOUT submitting — the user stays in control and can still edit or
// discard it. Never fabricates values for fields that are still unknown;
// generateICSR only fills what's in extractedData/meddraData already.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:conversationId/generate-draft', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const conversation = await getConversation(conversationId);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

    const extractedData = conversation.extractedData;
    if (!extractedData) {
      return res.status(400).json({ error: 'No information has been collected yet for this report.' });
    }

    const meddraData = conversation.meddraData || (await mapToMedDRA(extractedData));
    const completeness =
      conversation.completenessScore != null
        ? { completeness_score: conversation.completenessScore }
        : await assessCompleteness(extractedData);

    const icsr = await generateICSR(extractedData, meddraData, completeness);

    res.json({ icsr, extractedData, meddraData, completenessScore: completeness.completeness_score });
  } catch (error) {
    console.error('[POST /:conversationId/generate-draft]', error);
    res.status(500).json({ error: 'Failed to generate draft report', message: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/conversation/history/:conversationId
// ─────────────────────────────────────────────────────────────────────────────
router.get('/history/:conversationId', async (req, res) => {
  try {
    const conversation = await getConversation(req.params.conversationId);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    // A saved report can be resumed only by whoever started it. Phone-channel
    // conversations ('voice-line') are not tied to a browser identity.
    const owner = conversation.userId;
    if (owner && owner !== 'anonymous' && owner !== 'voice-line' && owner !== req.user?.uid) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    res.json({ ...conversation, messages: normalizeMessages(conversation.messages) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
