import { callGroq, MODEL_SMART } from '../services/nebiusService.js';

// ─────────────────────────────────────────────────────────────────────────────
// System prompt — the single source of conversation intelligence.
// The model returns valid JSON every time so we can parse structured data
// alongside the conversational reply without ever showing JSON to the user.
// ─────────────────────────────────────────────────────────────────────────────
function buildSystemPrompt(userType, language, extractedDataSoFar) {
  const isHCP = userType === 'healthcare_professional';

  // Summarise what we already know so the model never asks again
  const knownContext = buildKnownContext(extractedDataSoFar);

  return `You are Pharmaco's conversational pharmacovigilance assistant for India. Your job is to help users report adverse drug reactions (ADRs) for India's Pharmacovigilance Programme (PvPI) through natural, empathetic conversation — exactly the way ChatGPT would.

────────────────────────────────────────
PERSONA & TONE
────────────────────────────────────────
- Speak like a warm, knowledgeable healthcare assistant — never robotic, never scripted.
- Vary your sentence structure. Avoid formulaic phrases.
- Show genuine empathy ("I'm sorry you went through that", "That sounds really uncomfortable") — but only when contextually appropriate, not on every message.
- ${isHCP ? 'This user is a healthcare professional. Use clinical terminology. Request specific clinical details when natural.' : 'This user is a patient. Use plain language. Explain medical terms simply.'}
- Never use phrases like "Understood. Could you tell me..." as a template. Sound human.

────────────────────────────────────────
CONVERSATION RULES — CRITICAL
────────────────────────────────────────
1. NEVER repeat the greeting. Never say "Hello" or "Namaste" again after the first message.
2. NEVER ask for information that is already known (see KNOWN INFORMATION below).
3. Ask ONLY ONE question per reply — the single most useful missing piece.
4. If the user gives you multiple facts in one message, extract all of them silently and ask only about what is still missing.
5. If the user asks a medicine-related question, answer it FIRST, then smoothly continue collecting report information.
6. If the user corrects something, acknowledge the correction and update your understanding.
7. Keep replies under 80 words unless summarising the report.
8. Never follow a fixed question order. Determine what is most important to collect next based on context.
9. If you detect emergency symptoms (difficulty breathing, throat/face swelling, loss of consciousness, seizure, severe allergic reaction, severe bleeding, overdose), set emergency=true and advise calling 112 immediately. Pause normal ADR collection.
10. When all 3 required fields AND at least 4 optional fields are collected, set report_ready=true and provide a brief, friendly summary of what was collected, asking the user to confirm before saving.

────────────────────────────────────────
FIELDS TO COLLECT (silently, naturally)
────────────────────────────────────────
REQUIRED (collect first, but not as a fixed list):
  • suspected_medicine — name of the drug
  • adverse_reaction — what happened
  • onset_date — when the reaction started

OPTIONAL (collect naturally throughout):
  • dosage, frequency, route
  • reason_for_taking (indication)
  • medical_history
  • dechallenge (did stopping help?)
  • rechallenge (did restarting cause it again?)
  • concomitant_medications
  • outcome
  • hospitalization
  • patient_initials, age_group, gender
  • reporter_type

────────────────────────────────────────
KNOWN INFORMATION — DO NOT ASK AGAIN
────────────────────────────────────────
${knownContext || 'Nothing collected yet — this is the start of the conversation.'}

────────────────────────────────────────
MULTILINGUAL
────────────────────────────────────────
- Respond ENTIRELY in this language: ${language}
- If the user switches language mid-conversation, follow them.
- Internally normalize all extracted field values to English, but your conversational reply must be in ${language}.

────────────────────────────────────────
REPORT SUMMARY FORMAT
────────────────────────────────────────
When report_ready=true, your assistant_message should include a friendly summary like:
"Here's what I've noted so far:
• Medicine: [name]
• Reaction: [reaction]
• Started: [date]
• [other key fields]
Does everything look correct? I can save this report for you."

────────────────────────────────────────
OUTPUT FORMAT — MANDATORY
────────────────────────────────────────
You MUST respond with ONLY valid JSON. No markdown. No explanation outside the JSON.
This JSON will be parsed by code — any non-JSON output will break the system.

{
  "assistant_message": "Your conversational reply here in ${language}. This is what the user sees.",
  "fields": {
    "suspected_medicine": null,
    "adverse_reaction": null,
    "onset_date": null,
    "dosage": null,
    "frequency": null,
    "route": null,
    "reason_for_taking": null,
    "medical_history": null,
    "dechallenge": null,
    "rechallenge": null,
    "concomitant_medications": null,
    "outcome": null,
    "hospitalization": null,
    "patient_initials": null,
    "age_group": null,
    "gender": null,
    "reporter_type": null
  },
  "missing_fields": [],
  "report_ready": false,
  "emergency": false
}

Rules for the fields object:
- Include ONLY fields that were newly extracted from THIS conversation turn.
- If nothing new was extracted for a field, omit it (or set to null).
- Values must be in English regardless of what language the user spoke.
- concomitant_medications should be an array of strings if mentioned.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Build a human-readable summary of already-collected data for the system prompt
// ─────────────────────────────────────────────────────────────────────────────
function buildKnownContext(data) {
  if (!data) return null;

  const lines = [];

  const med = data.suspected_medicines?.[0];
  if (med?.name) lines.push(`• Suspected medicine: ${med.name}`);
  if (med?.dosage) lines.push(`• Dosage: ${med.dosage}`);
  if (med?.frequency) lines.push(`• Frequency: ${med.frequency}`);
  if (med?.route) lines.push(`• Route: ${med.route}`);
  if (med?.start_date) lines.push(`• Medicine start date: ${med.start_date}`);
  if (med?.stop_date) lines.push(`• Medicine stop date: ${med.stop_date}`);

  const rxn = data.adverse_reactions?.[0];
  if (rxn) {
    const rxnText = rxn.english_translation || rxn.original_text;
    if (rxnText) lines.push(`• Adverse reaction: ${rxnText}`);
    if (rxn.onset_date) lines.push(`• Reaction onset: ${rxn.onset_date}`);
    if (rxn.severity) lines.push(`• Severity: ${rxn.severity}`);
    if (rxn.resolution_date) lines.push(`• Resolution date: ${rxn.resolution_date}`);
    if (rxn.still_ongoing) lines.push(`• Reaction is still ongoing: yes`);
    if (rxn.duration) lines.push(`• Duration: ${rxn.duration}`);
  }

  const patient = data.patient;
  if (patient?.initials) lines.push(`• Patient initials: ${patient.initials}`);
  if (patient?.age_group) lines.push(`• Age group: ${patient.age_group}`);
  if (patient?.gender) lines.push(`• Gender: ${patient.gender}`);
  if (patient?.weight) lines.push(`• Weight: ${patient.weight}`);

  const clinical = data.clinical_context;
  if (clinical?.reason_for_taking) lines.push(`• Reason for taking medicine: ${clinical.reason_for_taking}`);
  if (clinical?.medical_history) lines.push(`• Medical history: ${clinical.medical_history}`);
  if (clinical?.outcome) lines.push(`• Outcome: ${clinical.outcome}`);
  if (clinical?.hospitalization != null) lines.push(`• Hospitalization: ${clinical.hospitalization}`);
  if (clinical?.concomitant_medications?.length > 0) {
    lines.push(`• Concomitant medications: ${clinical.concomitant_medications.join(', ')}`);
  }

  const causality = data.causality_signals;
  if (causality?.dechallenge && causality.dechallenge !== 'unknown') {
    lines.push(`• Dechallenge (stopped medicine improved reaction?): ${causality.dechallenge}`);
  }
  if (causality?.rechallenge && causality.rechallenge !== 'not_applicable') {
    lines.push(`• Rechallenge: ${causality.rechallenge}`);
  }

  const meta = data.metadata;
  if (meta?.reporter_type) lines.push(`• Reporter type: ${meta.reporter_type}`);

  return lines.length > 0 ? lines.join('\n') : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Count optional fields collected so far to determine report readiness
// ─────────────────────────────────────────────────────────────────────────────
function countOptionalFields(data) {
  if (!data) return 0;
  const med = data.suspected_medicines?.[0] || {};
  const rxn = data.adverse_reactions?.[0] || {};
  const patient = data.patient || {};
  const clinical = data.clinical_context || {};
  const causality = data.causality_signals || {};

  return [
    med.dosage,
    med.frequency,
    med.route,
    rxn.severity,
    rxn.resolution_date,
    rxn.duration,
    patient.initials,
    patient.age_group,
    patient.gender,
    clinical.reason_for_taking,
    clinical.medical_history,
    clinical.outcome,
    (clinical.concomitant_medications || []).length > 0,
    causality.dechallenge && causality.dechallenge !== 'unknown',
    causality.rechallenge && causality.rechallenge !== 'not_applicable',
  ].filter(Boolean).length;
}

// ─────────────────────────────────────────────────────────────────────────────
// Parse the LLM's JSON response safely
// ─────────────────────────────────────────────────────────────────────────────
function parseLLMResponse(raw) {
  // Strip any accidental markdown code fences
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (_) {
    // If JSON parse fails, treat the whole thing as the assistant message
    return {
      assistant_message: cleaned || "I'm here to help. Could you tell me more about what happened?",
      fields: {},
      missing_fields: [],
      report_ready: false,
      emergency: false,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Simple friendly fallback when the API fails — does NOT restart the conversation
// ─────────────────────────────────────────────────────────────────────────────
function buildFallback(language) {
  const fallbacks = {
    'hi-IN': 'क्षमा करें, मुझे एक पल के लिए रुकना पड़ा। क्या आप अपनी बात फिर से कह सकते हैं?',
    'kn-IN': 'ಕ್ಷಮಿಸಿ, ತಾಂತ್ರಿಕ ಸಮಸ್ಯೆ ಆಯಿತು. ದಯವಿಟ್ಟು ಮತ್ತೊಮ್ಮೆ ಹೇಳಿ.',
    'ta-IN': 'மன்னிக்கவும், தொழில்நுட்ப சிக்கல் ஏற்பட்டது. மீண்டும் சொல்லுங்கள்.',
    'te-IN': 'క్షమించండి, సాంకేతిక సమస్య వచ్చింది. దయచేసి మళ్ళీ చెప్పండి.',
    'mr-IN': 'माफ करा, एक तांत्रिक समस्या आली. कृपया पुन्हा सांगा.',
    'bn-IN': 'দুঃখিত, একটি প্রযুক্তিগত সমস্যা হয়েছে। অনুগ্রহ করে আবার বলুন।',
    'gu-IN': 'ક્ષમા કરો, ટેકનિકલ સમસ્યા આવી. કૃપા કરીને ફરી કહો.',
    'ml-IN': 'ക്ഷമിക്കൂ, ഒരു സാങ്കേതിക പ്രശ്നം ഉണ്ടായി. ദയവായി വീണ്ടും പറയൂ.',
  };
  return fallbacks[language] || "Sorry, I had a small technical hiccup. Could you repeat that?";
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export — get the next conversational message from the LLM
// Returns: { message, isEmergency, isReportReady, newFields }
// ─────────────────────────────────────────────────────────────────────────────
export async function getNextMessage(
  conversationHistory,
  userType = 'patient',
  language = 'en-IN',
  extractedDataSoFar = null
) {
  const systemPrompt = buildSystemPrompt(userType, language, extractedDataSoFar);

  // Send up to the last 24 messages (12 turns) to keep context tight and cost low
  const cappedHistory = conversationHistory
    .slice(-24)
    .map(({ role, content }) => ({ role, content }));

  try {
    const raw = await callGroq(
      systemPrompt,
      cappedHistory,
      MODEL_SMART,
      600,   // max tokens — enough for a friendly reply + JSON overhead
      0.55   // temperature — warmer than extraction but not hallucination-prone
    );

    const parsed = parseLLMResponse(raw);

    // Strip any accidental sentinel strings in case old prompts leak through
    let message = (parsed.assistant_message || buildFallback(language))
      .replace(/REPORT_READY/g, '')
      .replace(/EMERGENCY_TRIAGE/g, '')
      .trim();

    return {
      message,
      isEmergency: Boolean(parsed.emergency),
      isReportReady: Boolean(parsed.report_ready),
      newFields: parsed.fields || {},     // Caller can merge these into extractedData
    };
  } catch (error) {
    console.error('[ConversationAgent] LLM call failed:', error.message);
    // Return a safe fallback — do NOT reset conversation or re-greet
    return {
      message: buildFallback(language),
      isEmergency: false,
      isReportReady: false,
      newFields: {},
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Streaming variant — kept for API compatibility, same system prompt logic
// ─────────────────────────────────────────────────────────────────────────────
export async function streamNextMessage(
  conversationHistory,
  userType = 'patient',
  language = 'en-IN',
  extractedDataSoFar = null,
  onChunk
) {
  const { streamGroq } = await import('../services/nebiusService.js');
  let fullText = '';
  const systemPrompt = buildSystemPrompt(userType, language, extractedDataSoFar);

  const cappedHistory = conversationHistory
    .slice(-24)
    .map(({ role, content }) => ({ role, content }));

  await streamGroq(systemPrompt, cappedHistory, (chunk) => {
    fullText += chunk;
    if (onChunk) onChunk(chunk);
  });

  // Parse if the full text looks like JSON, else treat as plain message
  let message = fullText;
  let isEmergency = false;
  let isReportReady = false;

  if (fullText.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(fullText.trim());
      message = parsed.assistant_message || fullText;
      isEmergency = Boolean(parsed.emergency);
      isReportReady = Boolean(parsed.report_ready);
    } catch (_) {
      // Not JSON — use as-is but strip old sentinel strings
      message = fullText.replace('REPORT_READY', '').replace('EMERGENCY_TRIAGE', '').trim();
      isEmergency = fullText.includes('EMERGENCY_TRIAGE');
      isReportReady = fullText.includes('REPORT_READY');
    }
  }

  return { fullText: message, isEmergency, isReportReady };
}
