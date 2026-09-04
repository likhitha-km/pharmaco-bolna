import { callGroq, MODEL_FAST } from '../services/nebiusService.js';
import { extractJson } from '../utils/parseJson.js';

const SYSTEM_PROMPT = `You are a pharmacovigilance data extraction specialist. Extract structured ADR information from the conversation provided. Respond ONLY with valid JSON. No explanation, no markdown. For any field not present in the conversation, use null. For confidence, score 0.0 to 1.0 based on how explicitly the field was mentioned.

Never invent or guess a value that was not actually stated — leave it null/unknown instead. But do not under-extract either: read the WHOLE conversation carefully, including casual or indirect phrasing, and capture every fact the user actually gave, even if the answer to a specific field wasn't asked as a direct question. In particular:
- dechallenge: set to "positive" if the user says or implies the reaction got better/resolved/improved after the medicine was stopped or reduced (e.g. "she stopped it and the rash cleared up", "doctor took me off it and I felt better"). Set to "negative" if they say it did NOT improve after stopping. Otherwise "unknown".
- rechallenge: set to "positive" if symptoms returned after restarting the same medicine, "negative" if they did not return after restarting, "not_applicable" if the medicine was never restarted or this was never discussed.
- clinical_context.outcome: capture the patient's stated current status in their own words, normalized briefly (e.g. "fully recovered", "recovering", "still ongoing", "hospitalized then discharged") whenever they say anything about how they are now or how it ended — not just if asked "what is the outcome".
- clinical_context.hospitalization: true/false only if explicitly stated (e.g. "admitted to hospital" = true, "treated at home" = false); otherwise null.
Only set these when the conversation genuinely supports the value — this is about not missing what was actually said, not about guessing what probably happened.`;

const SCHEMA_EXAMPLE = `{
  "suspected_medicines": [
    {
      "name": "string",
      "brand_name": "string|null",
      "dosage": "string|null",
      "frequency": "string|null",
      "route": "string|null",
      "start_date": "string|null",
      "stop_date": "string|null",
      "confidence": 0.0
    }
  ],
  "adverse_reactions": [
    {
      "original_text": "string",
      "english_translation": "string",
      "onset_date": "string|null",
      "resolution_date": "string|null",
      "duration": "string|null",
      "severity": "mild|moderate|severe|null",
      "still_ongoing": true,
      "confidence": 0.0
    }
  ],
  "patient": {
    "initials": "string|null",
    "age_group": "string|null",
    "gender": "string|null",
    "weight": "string|null",
    "is_pregnant": null,
    "is_breastfeeding": null,
    "special_populations": []
  },
  "causality_signals": {
    "dechallenge": "positive|negative|unknown",
    "rechallenge": "positive|negative|not_applicable",
    "temporal_relationship": null,
    "alternative_explanation": null
  },
  "clinical_context": {
    "reason_for_taking": "string|null",
    "medical_history": "string|null",
    "concomitant_medications": [],
    "hospitalization": null,
    "outcome": "string|null"
  },
  "metadata": {
    "language_detected": "string",
    "reporter_type": "patient|healthcare_professional|caregiver|anonymous",
    "report_type": "adr|medication_error|product_quality|drug_interaction"
  }
}`;

/**
 * Extract structured pharmacovigilance data from conversation.
 * @param {Array} conversationHistory - [{role, content}]
 * @returns {Object} extracted structured data matching ICSR schema
 */
export async function extractFromConversation(conversationHistory) {
  const systemWithSchema = `${SYSTEM_PROMPT}\n\nOutput EXACTLY this JSON structure:\n${SCHEMA_EXAMPLE}`;

  // Flatten conversation to text for extraction
  const conversationText = conversationHistory
    .map((m) => `${m.role === 'user' ? 'Patient' : 'Assistant'}: ${m.content}`)
    .join('\n');

  try {
    const raw = await callGroq(
      systemWithSchema,
      [{ role: 'user', content: `Extract from this conversation:\n\n${conversationText}` }],
      MODEL_FAST,
      1500,
      0.1
    );

    const parsed = extractJson(raw);
    if (!parsed) throw new Error('Extraction model returned no parseable JSON');
    return parsed;
  } catch (error) {
    console.error('[ExtractionAgent] error:', error.message);
    // Return minimal valid structure
    return {
      suspected_medicines: [],
      adverse_reactions: [],
      patient: { initials: null, age_group: null, gender: null, weight: null, is_pregnant: null, is_breastfeeding: null, special_populations: [] },
      causality_signals: { dechallenge: 'unknown', rechallenge: 'not_applicable', temporal_relationship: null, alternative_explanation: null },
      clinical_context: { reason_for_taking: null, medical_history: null, concomitant_medications: [], hospitalization: null, outcome: null },
      metadata: { language_detected: 'en-IN', reporter_type: 'anonymous', report_type: 'adr' },
    };
  }
}
