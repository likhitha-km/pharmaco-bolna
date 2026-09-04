// Completeness is a deterministic presence/absence check over already
// -structured data — not a judgment call — so it's computed directly in
// code rather than via an LLM call. This removed a real bug where the LLM
// path had no guidance on the 0-100 vs 0-14 scale and was returning wildly
// wrong scores (e.g. 0% for a fully-collected report), and it removes an
// entire unreliable network round-trip from the "report ready" critical
// path.

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

const REQUIRED_FIELDS = ['suspected_medicine_name', 'adverse_reaction_description', 'onset_date'];

/**
 * Assess completeness of extracted ADR report data against PvPI ICSR
 * completeness requirements.
 * @param {Object} extractedData - output of extractionAgent
 * @returns {Object} completeness report
 */
export async function assessCompleteness(extractedData) {
  const data = extractedData || {};
  const completed = [];
  const missing = [];

  const checks = {
    patient_identifier: data.patient?.initials != null,
    age_group: data.patient?.age_group != null,
    gender: data.patient?.gender != null,
    suspected_medicine_name: data.suspected_medicines?.length > 0 && !!data.suspected_medicines[0]?.name,
    adverse_reaction_description: data.adverse_reactions?.length > 0,
    onset_date: data.adverse_reactions?.[0]?.onset_date != null,
    outcome: data.clinical_context?.outcome != null,
    reporter_type: data.metadata?.reporter_type != null,
    causality_signals_present: data.causality_signals?.dechallenge && data.causality_signals.dechallenge !== 'unknown',
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
  const priorityMissing = missing.filter((f) => REQUIRED_FIELDS.includes(f));
  const canGenerateIcsr = priorityMissing.length === 0;

  return {
    completeness_score: score,
    grade,
    completed_fields: completed,
    missing_fields: missing,
    priority_missing: priorityMissing,
    can_generate_icsr: canGenerateIcsr,
    quality_notes: canGenerateIcsr
      ? `Report meets minimum ICSR requirements. ${missing.length} optional field${missing.length === 1 ? '' : 's'} missing.`
      : `Missing required fields: ${priorityMissing.join(', ')}. Cannot generate ICSR until these are provided.`,
  };
}
