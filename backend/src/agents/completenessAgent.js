import { callGroq, MODEL_FAST } from '../services/nebiusService.js';

const SYSTEM_PROMPT = `You are a pharmacovigilance report quality assessor. Evaluate an extracted ADR report against PvPI ICSR completeness requirements. Score each field as present (1) or missing (0). Respond ONLY with valid JSON.`;

const FIELDS_TO_CHECK = [
  'patient_identifier',
  'age_group',
  'gender',
  'suspected_medicine_name',
  'adverse_reaction_description',
  'onset_date',
  'outcome',
  'reporter_type',
  'causality_signals_present',
  'dosage',
  'frequency',
  'medical_history',
  'concomitant_medications',
  'dechallenge_information',
];

const OUTPUT_SCHEMA = `{
  "completeness_score": 0,
  "grade": "A|B|C|D",
  "completed_fields": [],
  "missing_fields": [],
  "priority_missing": [],
  "can_generate_icsr": false,
  "quality_notes": "string"
}`;

/**
 * Assess completeness of extracted ADR report data.
 * @param {Object} extractedData - output of extractionAgent
 * @returns {Object} completeness report
 */
export async function assessCompleteness(extractedData) {
  try {
    const inputText = JSON.stringify(extractedData, null, 2);
    const prompt = `Check these ICSR fields in the extracted data and score completeness:\n\nFields to check: ${FIELDS_TO_CHECK.join(', ')}\n\nExtracted data:\n${inputText}\n\nOutput EXACTLY this JSON structure:\n${OUTPUT_SCHEMA}`;

    const raw = await callGroq(SYSTEM_PROMPT, [{ role: 'user', content: prompt }], MODEL_FAST, 800, 0.1);
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(cleaned);
    return result;
  } catch (error) {
    console.error('[CompletenessAgent] error:', error.message);
    // Fallback: manual assessment
    return manualAssessment(extractedData);
  }
}

function manualAssessment(data) {
  const completed = [];
  const missing = [];

  const checks = {
    patient_identifier: data.patient?.initials != null,
    age_group: data.patient?.age_group != null,
    gender: data.patient?.gender != null,
    suspected_medicine_name: data.suspected_medicines?.length > 0 && data.suspected_medicines[0]?.name,
    adverse_reaction_description: data.adverse_reactions?.length > 0,
    onset_date: data.adverse_reactions?.[0]?.onset_date != null,
    outcome: data.clinical_context?.outcome != null,
    reporter_type: data.metadata?.reporter_type != null,
    causality_signals_present: data.causality_signals?.dechallenge !== 'unknown',
    dosage: data.suspected_medicines?.[0]?.dosage != null,
    frequency: data.suspected_medicines?.[0]?.frequency != null,
    medical_history: data.clinical_context?.medical_history != null,
    concomitant_medications: (data.clinical_context?.concomitant_medications || []).length > 0,
    dechallenge_information: data.causality_signals?.dechallenge != null,
  };

  for (const [field, present] of Object.entries(checks)) {
    if (present) completed.push(field);
    else missing.push(field);
  }

  const score = Math.round((completed.length / FIELDS_TO_CHECK.length) * 100);
  const grade = score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 50 ? 'C' : 'D';
  const requiredFields = ['suspected_medicine_name', 'adverse_reaction_description', 'onset_date'];
  const priorityMissing = missing.filter((f) => requiredFields.includes(f));
  const canGenerateIcsr = priorityMissing.length === 0;

  return {
    completeness_score: score,
    grade,
    completed_fields: completed,
    missing_fields: missing,
    priority_missing: priorityMissing,
    can_generate_icsr: canGenerateIcsr,
    quality_notes: canGenerateIcsr
      ? `Report meets minimum ICSR requirements. ${missing.length} optional fields missing.`
      : `Missing required fields: ${priorityMissing.join(', ')}. Cannot generate ICSR until these are provided.`,
  };
}
