import { callGroq, MODEL_SMART } from '../services/nebiusService.js';

const MEDDRA_REFERENCE = `WHO MedDRA Preferred Terms reference list:
Dizziness 10013573 | Nausea 10028813 | Vomiting 10047700 | Headache 10019211 | Rash 10037844 | Fatigue 10016256 | Chest pain 10008479 | Tremor 10044565 | Dyspnoea 10013968 | Abdominal pain 10000081 | Insomnia 10022437 | Palpitations 10033557 | Oedema 10030095 | Pruritus 10037087 | Dry mouth 10013781 | Diarrhoea 10012735 | Constipation 10010774 | Blurred vision 10005886 | Hypertension 10020772 | Hypotension 10021097 | Tachycardia 10043071 | Bradycardia 10006093 | Urticaria 10046735 | Alopecia 10001760 | Jaundice 10023126 | Confusion 10010300 | Anxiety 10002855 | Depression 10012378 | Weight gain 10047899 | Weight loss 10047900 | Myalgia 10028411 | Arthralgia 10003239 | Fever 10016558 | Chills 10008531 | Sweating 10042241 | Flushing 10016825 | Anorexia 10002646 | Flatulence 10016766 | Dyspepsia 10013946 | Gastritis 10017853 | Hepatotoxicity 10019851 | Nephrotoxicity 10029149 | Peripheral neuropathy 10034620 | Paraesthesia 10033775 | Amnesia 10001949 | Somnolence 10041349 | Hallucination 10019063 | Agitation 10001497 | Syncope 10042772 | Vertigo 10047166 | Tinnitus 10043882 | Angioedema 10002424 | Anaphylaxis 10002198 | Stevens-Johnson syndrome 10042033 | Drug reaction with eosinophilia 10013700 | Thrombocytopenia 10043554 | Leucopenia 10024318 | Anaemia 10002034 | Hyperglycaemia 10020635 | Hypoglycaemia 10021005 | Hyponatraemia 10021026 | Hypokalaemia 10021015 | QT prolongation 10037396 | Pulmonary embolism 10037377 | Deep vein thrombosis 10051055 | Stroke 10042244 | Myocardial infarction 10028596 | Renal failure 10038435 | Liver failure 10024690 | Pancreatitis 10033645 | Colitis 10009887 | Photosensitivity 10034966 | Acne 10000496 | Dry skin 10013786 | Hair loss 10001760 | Muscle weakness 10028356 | Back pain 10003988 | Joint swelling 10023216 | Cough 10011224 | Rhinitis 10039085 | Conjunctivitis 10010741`;

const SYSTEM_PROMPT = `You are a WHO MedDRA medical terminology mapper. Map each adverse reaction description to the most appropriate MedDRA Preferred Term from the reference list. Also assess WHO-UMC causality: Certain, Probable, Possible, or Unlikely based on temporal relationship, dechallenge, rechallenge, and alternative explanation signals. Respond ONLY with valid JSON.

${MEDDRA_REFERENCE}

WHO-UMC Causality Categories:
- Certain: Plausible time relationship, confirmed by dechallenge, rechallenge positive, unlikely due to disease
- Probable: Reasonable time sequence, unlikely due to disease, confirmed by dechallenge, rechallenge not done
- Possible: Reasonable time sequence, could be explained by disease, dechallenge absent or unclear
- Unlikely: Time sequence less suggestive, disease or other drugs provide plausible explanation`;

const OUTPUT_SCHEMA = `{
  "meddra_mappings": [
    {
      "original_text": "string",
      "preferred_term": "string",
      "meddra_code": "string",
      "soc": "string",
      "mapping_confidence": 0.0,
      "mapping_notes": "string|null"
    }
  ],
  "causality_assessment": {
    "category": "Certain|Probable|Possible|Unlikely",
    "who_umc_basis": "string",
    "confidence": 0.0,
    "flags_for_review": []
  },
  "seriousness": {
    "is_serious": false,
    "criteria": [],
    "requires_expedited_reporting": false
  }
}`;

/**
 * Map adverse reactions to MedDRA and assess causality.
 * @param {Object} extractedData - output of extractionAgent
 * @returns {Object} MedDRA mappings + causality assessment
 */
export async function mapToMedDRA(extractedData) {
  const reactions = extractedData.adverse_reactions || [];
  const causalitySignals = extractedData.causality_signals || {};

  const inputText = JSON.stringify({
    adverse_reactions: reactions,
    causality_signals: causalitySignals,
    clinical_context: extractedData.clinical_context || {},
  });

  try {
    const raw = await callGroq(
      `${SYSTEM_PROMPT}\n\nOutput EXACTLY this JSON structure:\n${OUTPUT_SCHEMA}`,
      [{ role: 'user', content: `Map these ADRs and assess causality:\n${inputText}` }],
      MODEL_SMART,
      1500,
      0.1
    );

    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch (error) {
    console.error('[MappingAgent] error:', error.message);
    return {
      meddra_mappings: reactions.map((r) => ({
        original_text: r.original_text || '',
        preferred_term: r.english_translation || r.original_text || 'Unknown',
        meddra_code: '10000000',
        soc: 'General disorders',
        mapping_confidence: 0.5,
        mapping_notes: 'Automated mapping — manual review recommended',
      })),
      causality_assessment: { category: 'Possible', who_umc_basis: 'Insufficient data for stronger assessment', confidence: 0.5, flags_for_review: [] },
      seriousness: { is_serious: false, criteria: [], requires_expedited_reporting: false },
    };
  }
}
