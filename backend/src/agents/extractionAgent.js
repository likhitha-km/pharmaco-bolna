import { callGroq, MODEL_FAST } from '../services/nebiusService.js';

const SYSTEM_PROMPT = `You are a pharmacovigilance data extraction specialist. Extract structured ADR information from the conversation provided. Respond ONLY with valid JSON. No explanation, no markdown. For any field not present in the conversation, use null. For confidence, score 0.0 to 1.0 based on how explicitly the field was mentioned.`;

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

    // Strip markdown code fences if present
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
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
