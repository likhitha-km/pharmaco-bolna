import { callGroq, MODEL_FAST } from '../services/nebiusService.js';
import { extractJson } from '../utils/parseJson.js';
import { emergencyMessage, resolveLanguage } from '../utils/languageSupport.js';

// ─────────────────────────────────────────────────────────────────────────────
// Emergency triage.
//
// A symptom is not an emergency. "Dizzy", "headache", "nausea" or "rash" on
// their own are common medicine side effects and must be explored with
// follow-up questions, not escalated. An EMERGENCY needs a genuine red flag —
// trouble breathing, swelling of the face/throat, actual loss of
// consciousness, chest pain, seizure, heavy bleeding, and so on — either
// described by the patient or confirmed when they answer a screening question.
//
// Three outcomes:
//   emergency      – a red flag is present → localized 112/108 advice, now.
//   undetermined   – can't tell (possible red flag, or the model was
//                    unavailable). Never reported as "fine": the conversation
//                    agent is told to ask red-flag screening questions.
//   non_emergency  – no red flag so far. Monitoring continues on every turn.
//
// Layer 1 is deterministic multilingual red-flag matching (instant, no LLM).
// Layer 2 is an LLM that classifies against a FIXED list of red flags with the
// recent conversation as context. The model can only name flags from that
// list, so it cannot declare an emergency just because a symptom "sounds bad",
// and it never writes the advice shown to the patient — that comes from the
// per-language templates in languageSupport.js.
// ─────────────────────────────────────────────────────────────────────────────

export const RED_FLAGS = [
  'breathing_difficulty',
  'airway_or_face_swelling',
  'anaphylaxis',
  'loss_of_consciousness',
  'chest_pain',
  'severe_bleeding',
  'seizure',
  'severe_skin_reaction',
  'blood_in_vomit_or_stool',
  'stroke_signs',
  'overdose',
];

// Symptoms that are common ADRs and need follow-up questions, not escalation.
const SCREEN_WORTHY = ['dizziness', 'lightheadedness', 'headache', 'nausea', 'vomiting', 'rash', 'itching', 'palpitations', 'weakness', 'fever', 'swelling'];

const NEGATIONS = new Set([
  'no', 'not', 'never', 'without', "don't", 'dont', "doesn't", 'doesnt', "didn't", 'didnt', 'neither', 'nor',
  'nahi', 'nahin', 'nhi', 'nahee', 'नहीं', 'नही', 'ना', 'न',
  'ಇಲ್ಲ', 'ಇಲ್ಲದೆ', 'இல்லை', 'இல்ல', 'లేదు', 'లేకుండా', 'नाही', 'नाहीत', 'নেই', 'নয়', 'না', 'નથી', 'નહીં', 'ഇല്ല', 'ഇല്ലാതെ',
]);

// `selfNegating` patterns carry their own negation ("can't breathe",
// "सांस नहीं आ रही"), so a nearby "no/नहीं" must not cancel them.
const RULES = [
  { flag: 'breathing_difficulty', selfNegating: true, re: /\b(can'?t|cannot|can not|unable to|not able to|couldn'?t) (get (enough )?(air|breath)|breathe)\b|\bgasping\b|saans nahi aa|सांस नहीं आ|साँस नहीं आ|दम घुट|dam ghut/iu },
  { flag: 'breathing_difficulty', re: /\b(difficulty|trouble|hard(ship)?|struggling|problem)\s+(in\s+|with\s+)?breathing\b|\bshort(ness)? of breath\b|\bbreathless(ness)?\b|\bdyspn(o)?ea\b|\bwheez(e|ing)\b|saans lene mein|sans lene mein|sans karne mein|सांस लेने में|साँस लेने में|सांस फूल|साँस फूल|सांस की तकलीफ|साँस की तकलीफ|ಉಸಿರಾಟದ ತೊಂದರೆ|ಉಸಿರಾಡಲು ಕಷ್ಟ|ಉಸಿರು ತೆಗೆದುಕೊಳ್ಳಲು ಕಷ್ಟ|மூச்சு விட சிரமம்|மூச்சுத் திணறல்|மூச்சு விட முடியவில்லை|శ్వాస తీసుకోవడంలో ఇబ్బంది|ఊపిరి తీసుకోవడం కష్టం|ఊపిరి ఆడ|श्वास घेण्यास त्रास|श्वास घेताना त्रास|दम लागतो|শ্বাসকষ্ট|নিঃশ্বাস নিতে কষ্ট|શ્વાસ લેવામાં (તકલીફ|મુશ્કેલી)|ശ്വാസം മുട്ട|ശ്വാസം എടുക്കാൻ ബുദ്ധിമുട്ട്/iu },
  { flag: 'airway_or_face_swelling', re: /\bthroat\s+(is\s+|was\s+|feels?\s+)?(closing|swelling|swollen|tight|shutting)\b|\b(face|lips?|tongue|eyelids?)\s+(is\s+|are\s+|was\s+|were\s+|has\s+|have\s+)?(been\s+)?(swelling|swollen|swell(ed)? up)\b|gala band|gale mein sujan|chehre (par|pe) sujan|honth sooj|गला बंद|गले में सूजन|चेहरे (पर|में) सूजन|होंठ(ों)? (पर )?सूज|जीभ सूज|ಗಂಟಲು ಬಿಗಿ|ಮುಖ ಊದಿ|தொண்டை அடைப்பு|முகம் வீங்க|గొంతు మూసుకు|ముఖం వాపు|घसा बंद|चेहरा सुजला|গলা বন্ধ|মুখ ফুলে|ગળું બંધ|ચહેરા પર સોજો|തൊണ്ട അടയു|മുഖം വീർ/iu },
  { flag: 'anaphylaxis', re: /anaphyla|severe allergic reaction|allergy attack|गंभीर एलर्जी|ತೀವ್ರ ಅಲರ್ಜಿ|கடுமையான ஒவ்வாமை/iu },
  { flag: 'loss_of_consciousness', re: /\b(fainted|blacked out|passed out|collapsed|lost consciousness|loss of consciousness|unconscious|unresponsive)\b|behosh ho\s*g|hosh kho|बेहोश\s*हो\s*ग[यईए]|बेहोश\s*हुआ|बेहोश\s*हुई|बेहोशी\s*छा\s*ग|होश\s*खो|ಪ್ರಜ್ಞೆ ತಪ್ಪಿ|ಮೂರ್ಛೆ ಹೋ|மயங்கி விழ|மயக்கமடை|స్పృహ కోల్పోయ|మూర్ఛపోయ|बेशुद्ध\s*(झाल|पडल)|অজ্ঞান\s*হয়ে|બેભાન\s*થ|ബോധം പോയ|ബോധരഹിത/iu },
  { flag: 'chest_pain', re: /\bchest\s+(pain|tightness|pressure|heaviness)\b|\bheart attack\b|seene mein (dard|jakdan)|chhati mein dard|सीने में (तेज )?(दर्द|जकड़न|भारीपन|दबाव)|छाती में (तेज )?(दर्द|जकड़न|भारीपन)|दिल का दौरा|ಎದೆ ನೋವು|ಎದೆಯಲ್ಲಿ ನೋವು|நெஞ்சு வலி|நெஞ்சில் வலி|ఛాతీ నొప్పి|ఛాతీలో నొప్పి|గుండె నొప్పి|छातीत (दुखत|दुखणे|वेदना)|বুকে ব্যথা|છાતીમાં દુખાવો|നെഞ്ചുവേദന|നെഞ്ച് വേദന/iu },
  { flag: 'severe_bleeding', re: /\b(severe|heavy|profuse|uncontrolled)\s+bleeding\b|\bbleeding\s+(a lot|heavily|badly)\b|\b(h)?a?emorrhage\b|bahut (zyada )?khoon|खून (बहुत|बह रहा)|बहुत (ज़्यादा |ज्यादा )?खून|ತೀವ್ರ ರಕ್ತಸ್ರಾವ|கடுமையான இரத்தப்போக்கு|తీవ్ర రక్తస్రావం|खूप रक्तस्राव|প্রচুর রক্ত|ખૂબ લોહી|കഠിനമായ രക്തസ്രാവം/iu },
  { flag: 'seizure', re: /\b(seizures?|convulsions?|convulsing)\b|\b(had|having|got) (a )?fits?\b|mirgi|fit aa|मिर्गी|दौरा\s*(पड़|आ)|दौरे|ಸೆಳೆತ|ಅಪಸ್ಮಾರ|வலிப்பு|మూర్ఛ|फेफरे|খিঁচুনি|આંચકી|ഫിറ്റ്സ്|അപസ്മാരം/iu },
  { flag: 'severe_skin_reaction', re: /\bskin\s+(is\s+)?(peeling|blistering)\b|\bblisters?\s+(all over|everywhere)\b|त्वचा\s*(छिल|उतर)|पूरे शरीर (पर|में) छाले|ಚರ್ಮ ಸುಲಿ|தோல் உரி|చర్మం ఊడ|त्वचा सोलव|ত্বক উঠে|ચામડી ઉતર|ചർമ്മം പൊളി/iu },
  { flag: 'blood_in_vomit_or_stool', re: /\bblood\s+(in|with)\s+(my\s+|the\s+)?(vomit|stool|poop|motion)s?\b|\bvomit(ing|ed)?\s+blood\b|\b(black|tarry)\s+stools?\b|\bmelena\b|\bh(a)?ematemesis\b|ulti mein khoon|potty mein khoon|उल्टी में खून|मल में खून|काला मल|ವಾಂತಿಯಲ್ಲಿ ರಕ್ತ|மலத்தில் இரத்தம்|వాంతిలో రక్తం|उलटीत रक्त|বমিতে রক্ত|ઉલટીમાં લોહી|ഛർദ്ദിയിൽ രക്തം/iu },
  { flag: 'stroke_signs', re: /\bslurred speech\b|\bface\s+(is\s+)?droop(ing)?\b|\b(one|half)\s+side\b.{0,25}\b(weak|numb|paraly)|चेहरा टेढ़ा|ज़ुबान लड़खड़ा|जबान लड़खड़ा|एक तरफ़? (से )?(कमज़ोर|कमजोर|सुन्न)|आधा शरीर (सुन्न|कमज़ोर|कमजोर)/iu },
  { flag: 'overdose', re: /\boverdos(e|ed|ing)\b|ओवरडोज़?|ज़्यादा गोलियां खा|ज्यादा गोलियां खा/iu },
];

function tokens(s) {
  return String(s || '').toLowerCase().split(/[\s,.;:!?()"'।|/\\-]+/).filter(Boolean);
}

function isNegated(text, start, end) {
  const before = tokens(text.slice(Math.max(0, start - 30), start)).slice(-3);
  const after = tokens(text.slice(end, end + 30)).slice(0, 3);
  return [...before, ...after].some((t) => NEGATIONS.has(t));
}

/**
 * Deterministic multilingual red-flag matching on the patient's latest message.
 * A match sitting next to a negation ("no chest pain", "सीने में दर्द नहीं")
 * is returned as `negated` — NOT as present — and never silently dropped: the
 * LLM layer still reads the full message.
 */
export function detectRedFlags(message) {
  const text = String(message || '');
  const present = new Set();
  const negated = new Set();
  for (const rule of RULES) {
    const re = new RegExp(rule.re.source, rule.re.flags.includes('g') ? rule.re.flags : `${rule.re.flags}g`);
    let m;
    while ((m = re.exec(text)) !== null) {
      if (!m[0]) { re.lastIndex += 1; continue; }
      if (!rule.selfNegating && isNegated(text, m.index, m.index + m[0].length)) negated.add(rule.flag);
      else present.add(rule.flag);
    }
  }
  for (const f of present) negated.delete(f);
  return { present: [...present], negated: [...negated] };
}

const SYSTEM_PROMPT = `You are a clinical safety screener inside a pharmacovigilance (medicine side-effect reporting) chat for India. Read the recent conversation and decide whether the patient's LATEST message, in context, reveals any of the RED FLAGS below.

RED FLAGS (use exactly these identifiers):
- breathing_difficulty: trouble breathing, breathlessness, gasping, wheezing
- airway_or_face_swelling: swelling of the face, lips, tongue or throat, or throat tightness/closing
- anaphylaxis: severe whole-body allergic reaction
- loss_of_consciousness: the patient ACTUALLY fainted, blacked out, collapsed or was unresponsive
- chest_pain: chest pain, tightness or pressure
- severe_bleeding: heavy or uncontrolled bleeding
- seizure: seizure, fits, convulsions
- severe_skin_reaction: widespread blistering or peeling skin, or blisters in the mouth/eyes
- blood_in_vomit_or_stool: vomiting blood, black/tarry or bloody stool
- stroke_signs: slurred speech, face drooping, weakness or numbness on one side of the body
- overdose: took far more than prescribed

CRITICAL RULES
1. A symptom is NOT a red flag. Dizziness, giddiness, lightheadedness, headache, nausea, vomiting, diarrhoea, stomach upset, a mild rash, itching, tiredness, sleepiness, mild fever, palpitations on their own are common side effects. Do NOT list them as red flags.
2. "Feeling like I might faint" is NOT loss of consciousness. Only actual fainting/collapse is.
3. Use the conversation. If the assistant asked a screening question (e.g. "are you having trouble breathing or chest pain?") and the patient answers yes / haan / ಹೌದು / ஆம் / etc., that red flag IS present. If they answer no / nahi / नहीं, list it under "ruled_out". A bare "no" after a multi-part question rules out what was asked.
4. Put a flag in "red_flags" only if the patient described it or confirmed it. If it MIGHT be present but is unclear, put it in "uncertain_red_flags". Never guess a flag from a symptom that merely sounds serious.
5. A negated flag ("no chest pain", "सीने में दर्द नहीं है") is not present.
6. The patient may write in ANY Indian language, Hinglish, or a mix. Understand the plain meaning.
7. "screening_complete" is true ONLY if the patient has already been asked about, and answered, the key red flags relevant to what they reported (for dizziness: fainting, chest pain, breathing trouble, sudden/severe onset, one-sided weakness or slurred speech). If they reported no concerning symptom yet, or were not asked, it is false.
8. "symptoms" lists the symptoms the patient mentioned, in simple English words (e.g. "dizziness", "headache").

Respond ONLY with JSON:
{
  "red_flags": [],
  "uncertain_red_flags": [],
  "ruled_out": [],
  "symptoms": [],
  "screening_complete": false
}`;

function buildTranscript(message, history) {
  const recent = (history || [])
    .filter((m) => m && m.content && (m.role === 'user' || m.role === 'assistant'))
    .slice(-6)
    .map((m) => `${m.role === 'user' ? 'PATIENT' : 'ASSISTANT'}: ${String(m.content).slice(0, 600)}`);
  // `history` may or may not already end with the latest message.
  const last = recent[recent.length - 1] || '';
  if (!last.endsWith(String(message).slice(0, 600))) recent.push(`PATIENT: ${String(message).slice(0, 600)}`);
  return `Conversation so far:\n${recent.join('\n')}\n\nDecide for the LATEST PATIENT message.`;
}

const validFlags = (list) => [...new Set((Array.isArray(list) ? list : []).filter((f) => RED_FLAGS.includes(f)))];

function result(status, extra = {}) {
  const is_emergency = status === 'emergency';
  return {
    triage_status: status,
    is_emergency,
    red_flags: [],
    uncertain_red_flags: [],
    ruled_out: [],
    symptoms: [],
    screening_complete: false,
    detected_symptoms: [],
    urgency_level: is_emergency ? 'immediate' : status === 'undetermined' ? 'monitor' : 'none',
    emergency_message: null,
    continue_reporting: true,
    source: 'none',
    ...extra,
  };
}

/**
 * Triage the patient's latest message in the context of the conversation.
 *
 * @param {string} message  latest patient message (any language)
 * @param {object} [opts]
 * @param {string} [opts.language]  conversation language — emergency advice is returned in it
 * @param {Array<{role,content}>} [opts.history]  recent turns, for short answers like "yes"
 * @param {Function} [opts.llm]  chat function (defaults to Nebius); injectable for tests
 */
export async function triageMessage(message, { language, history = [], llm = callGroq } = {}) {
  const lang = resolveLanguage(language);
  const text = String(message || '');
  const keyword = detectRedFlags(text);

  // Layer 1 — a clear, non-negated red flag is an emergency immediately.
  if (keyword.present.length > 0) {
    return result('emergency', {
      red_flags: keyword.present,
      detected_symptoms: keyword.present,
      emergency_message: emergencyMessage(lang),
      source: 'keyword',
    });
  }

  // Layer 2 — context-aware classification against the fixed red-flag list.
  try {
    const raw = await llm(SYSTEM_PROMPT, [{ role: 'user', content: buildTranscript(text, history) }], MODEL_FAST, 300, 0);
    const parsed = extractJson(raw);
    if (!parsed || typeof parsed !== 'object') throw new Error('Triage model returned no parseable JSON');

    const redFlags = validFlags(parsed.red_flags);
    const uncertain = validFlags(parsed.uncertain_red_flags).filter((f) => !redFlags.includes(f));
    const ruledOut = validFlags(parsed.ruled_out);
    const symptoms = (Array.isArray(parsed.symptoms) ? parsed.symptoms : []).map((s) => String(s).toLowerCase()).slice(0, 12);
    const common = {
      ruled_out: ruledOut,
      symptoms,
      detected_symptoms: symptoms,
      screening_complete: Boolean(parsed.screening_complete),
      source: 'llm',
    };

    if (redFlags.length > 0) {
      return result('emergency', { ...common, red_flags: redFlags, emergency_message: emergencyMessage(lang) });
    }
    // A keyword that sat next to a negation, or a model-flagged unclear flag,
    // means "don't know yet" — not "safe".
    const unclear = [...new Set([...uncertain, ...keyword.negated.filter((f) => !ruledOut.includes(f))])];
    if (unclear.length > 0) return result('undetermined', { ...common, uncertain_red_flags: unclear });
    return result('non_emergency', common);
  } catch (error) {
    console.error('[TriageAgent] LLM triage unavailable — status is undetermined, not safe:', error.message);
    return result('undetermined', {
      uncertain_red_flags: keyword.negated,
      source: 'unavailable',
    });
  }
}

/** Plain-language summary of triage state for the conversation agent's prompt. */
export function summarizeTriageForPrompt(state) {
  if (!state) return 'No triage information yet. Screen for red flags if the patient mentions any symptom.';
  const lines = [`Status: ${state.status || 'undetermined'}`];
  if (state.symptoms?.length) lines.push(`Symptoms reported: ${state.symptoms.join(', ')}`);
  if (state.ruledOut?.length) lines.push(`Red flags the patient has already denied (do NOT ask again): ${state.ruledOut.join(', ')}`);
  if (state.uncertain?.length) lines.push(`Red flags that are still unclear (ask about these first): ${state.uncertain.join(', ')}`);
  lines.push(`Red-flag screening completed: ${state.screeningComplete ? 'yes' : 'NO'}`);
  return lines.join('\n');
}

/** Merge one turn's triage result into the persisted per-conversation triage state. */
export function mergeTriageState(prev, t) {
  const ruledOut = [...new Set([...(prev?.ruledOut || []), ...(t.ruled_out || [])])].filter((f) => !(t.red_flags || []).includes(f));
  const symptoms = [...new Set([...(prev?.symptoms || []), ...(t.symptoms || [])])].slice(-15);
  return {
    status: t.triage_status,
    symptoms,
    ruledOut,
    uncertain: t.uncertain_red_flags || [],
    screeningComplete: Boolean(t.screening_complete),
    redFlags: [...new Set([...(prev?.redFlags || []), ...(t.red_flags || [])])],
    updatedAt: new Date().toISOString(),
  };
}

export { SCREEN_WORTHY };
