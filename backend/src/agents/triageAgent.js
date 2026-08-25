import { callGroq, MODEL_FAST } from '../services/nebiusService.js';

const EMERGENCY_SYMPTOMS = [
  'difficulty breathing', 'dyspnoea', 'breathlessness', 'sans karne mein takleef', 'saans nahi aa rahi',
  'anaphylaxis', 'severe allergic reaction', 'allergy attack',
  'loss of consciousness', 'unconscious', 'behoshi', 'hosh kho diya',
  'severe chest pain', 'heart attack', 'seene mein dard',
  'severe bleeding', 'bahut zyada khoon', 'haemorrhage',
  'throat swelling', 'gala band', 'throat closing',
  'seizure', 'fits', 'mirgi', 'convulsion',
  'severe skin reaction', 'skin peeling', 'blisters all over',
  'blood in vomit', 'hematemesis', 'ulti mein khoon',
  'blood in stool', 'melena',
];

const SYSTEM_PROMPT = `You are an emergency triage specialist for pharmacovigilance. Analyze the message for any symptoms that could indicate a life-threatening emergency. Be sensitive to indirect or culturally expressed descriptions of these symptoms in any Indian language. Respond ONLY with valid JSON.

Emergency symptoms to detect:
- Difficulty breathing / dyspnoea / sans karne mein takleef
- Anaphylaxis / severe allergic reaction
- Loss of consciousness / behoshi
- Severe chest pain / seene mein dard
- Severe bleeding / bahut zyada khoon
- Throat swelling / gala band hona
- Seizure / fits / mirgi
- Severe skin reaction covering large body area
- Blood in vomit or stool`;

const OUTPUT_SCHEMA = `{
  "is_emergency": false,
  "detected_symptoms": [],
  "urgency_level": "immediate|urgent|monitor|none",
  "emergency_message": null,
  "continue_reporting": true
}`;

/**
 * Fast keyword-based pre-check before calling LLM.
 */
function keywordCheck(message) {
  const lower = message.toLowerCase();
  return EMERGENCY_SYMPTOMS.some((sym) => lower.includes(sym));
}

/**
 * Analyze message for emergency symptoms.
 * @param {string} message - user's message in any language
 * @returns {{ is_emergency, detected_symptoms, urgency_level, emergency_message, continue_reporting }}
 */
export async function triageMessage(message) {
  // Fast path: keyword detection
  const hasKeyword = keywordCheck(message);

  // If no emergency keywords detected, return immediately without calling LLM (0ms latency)
  if (!hasKeyword) {
    return {
      is_emergency: false,
      detected_symptoms: [],
      urgency_level: 'none',
      emergency_message: null,
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

    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(cleaned);

    // If keyword check triggered but LLM didn't catch it, elevate
    if (hasKeyword && !result.is_emergency) {
      result.is_emergency = true;
      result.urgency_level = 'urgent';
    }

    if (result.is_emergency && !result.emergency_message) {
      result.emergency_message =
        'This sounds like a medical emergency. Please call 112 or go to your nearest hospital immediately.';
    }

    return result;
  } catch (error) {
    console.error('[TriageAgent] error:', error.message);
    // Fallback to keyword check result
    return {
      is_emergency: hasKeyword,
      detected_symptoms: [],
      urgency_level: hasKeyword ? 'urgent' : 'none',
      emergency_message: hasKeyword
        ? 'This sounds like a medical emergency. Please call 112 immediately.'
        : null,
      continue_reporting: true,
    };
  }
}
