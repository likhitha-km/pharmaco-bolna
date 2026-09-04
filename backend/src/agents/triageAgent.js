import { callGroq, MODEL_FAST } from '../services/nebiusService.js';
import { extractJson } from '../utils/parseJson.js';

// Exact-phrase fast path — an unambiguous hit here is treated as an
// emergency immediately, with zero LLM latency. This is a safety net for
// the clearest cases, NOT the only detection mechanism (see triageMessage
// below, which always consults the LLM when nothing here matches).
const EMERGENCY_SYMPTOMS = [
  'difficulty breathing', 'dyspnoea', 'breathlessness', "can't breathe", 'cant breathe', 'cannot breathe',
  'not able to breathe', "can't get enough air", 'gasping for air', 'closing up',
  'sans karne mein takleef', 'saans nahi aa rahi', 'saans lene mein', 'dam ghut',
  'anaphylaxis', 'severe allergic reaction', 'allergy attack',
  'loss of consciousness', 'unconscious', 'behoshi', 'hosh kho diya',
  'severe chest pain', 'heart attack', 'seene mein dard',
  'severe bleeding', 'bahut zyada khoon', 'haemorrhage',
  'throat swelling', 'gala band', 'throat closing', 'throat is closing',
  'seizure', 'fits', 'mirgi', 'convulsion',
  'severe skin reaction', 'skin peeling', 'blisters all over',
  'blood in vomit', 'hematemesis', 'ulti mein khoon',
  'blood in stool', 'melena',
];

const SYSTEM_PROMPT = `You are an emergency triage specialist for pharmacovigilance. Analyze the message for any symptoms that could indicate a life-threatening emergency related to a medicine reaction. Be sensitive to indirect, informal, or culturally expressed descriptions of these symptoms in ANY language (English, Hindi, Hinglish, or other Indian languages) — the user will rarely use clinical terminology. Do not require an exact phrase match; use your judgment on the plain meaning of what they wrote. Respond ONLY with valid JSON.

Emergency symptoms to detect (and their many natural ways of being phrased):
- Difficulty breathing — e.g. "can't breathe", "can't get enough air", "gasping", "saans lene mein takleef"
- Throat or facial swelling that could obstruct breathing — e.g. "throat closing up", "gala band ho raha hai"
- Anaphylaxis / severe allergic reaction
- Loss of consciousness / fainting / "behoshi"
- Severe chest pain / possible heart attack
- Severe or uncontrolled bleeding
- Seizure / fits / convulsions
- Severe skin reaction covering a large area of the body (e.g. widespread blistering, skin peeling)
- Blood in vomit or stool

Do NOT diagnose the underlying condition — only flag whether this reads as a potential emergency needing immediate medical attention. When genuinely uncertain but the description is concerning, lean toward flagging it (err on the side of caution) rather than dismissing it.`;

const OUTPUT_SCHEMA = `{
  "is_emergency": false,
  "detected_symptoms": [],
  "urgency_level": "immediate|urgent|monitor|none",
  "emergency_message": null,
  "continue_reporting": true
}`;

const DEFAULT_EMERGENCY_MESSAGE =
  'This sounds like a medical emergency. Please call 112 or go to your nearest hospital immediately.';

/**
 * Fast exact-phrase pre-check — catches the clearest cases instantly.
 */
function keywordCheck(message) {
  const lower = message.toLowerCase();
  return EMERGENCY_SYMPTOMS.some((sym) => lower.includes(sym));
}

/**
 * Analyze message for emergency symptoms.
 *
 * An exact keyword match short-circuits to an immediate emergency response
 * (no LLM round-trip needed for the unambiguous cases). Otherwise the LLM
 * is ALWAYS consulted — it used to be skipped whenever no exact keyword
 * matched, which meant natural phrasing like "I can't breathe" or a
 * multilingual variant that wasn't in the fixed list was silently treated
 * as safe. That gap is what this fixes.
 *
 * @param {string} message - user's message in any language
 * @returns {{ is_emergency, detected_symptoms, urgency_level, emergency_message, continue_reporting }}
 */
export async function triageMessage(message) {
  if (keywordCheck(message)) {
    return {
      is_emergency: true,
      detected_symptoms: [],
      urgency_level: 'urgent',
      emergency_message: DEFAULT_EMERGENCY_MESSAGE,
      continue_reporting: true,
    };
  }

  try {
    const raw = await callGroq(
      `${SYSTEM_PROMPT}\n\nOutput EXACTLY this JSON:\n${OUTPUT_SCHEMA}`,
      [{ role: 'user', content: `Analyze for emergency: "${message}"` }],
      MODEL_FAST,
      300,
      0.1
    );

    const result = extractJson(raw);
    if (!result) throw new Error('Triage model returned no parseable JSON');

    if (result.is_emergency && !result.emergency_message) {
      result.emergency_message = DEFAULT_EMERGENCY_MESSAGE;
    }

    return result;
  } catch (error) {
    console.error('[TriageAgent] LLM triage failed, no keyword signal either — treating as non-emergency:', error.message);
    // No exact keyword and the model call itself failed — we have no
    // signal either way. Matches prior behaviour for the "nothing detected"
    // case rather than alarming on every transient API error.
    return {
      is_emergency: false,
      detected_symptoms: [],
      urgency_level: 'none',
      emergency_message: null,
      continue_reporting: true,
    };
  }
}
