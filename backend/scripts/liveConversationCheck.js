// Live check of the conversation pipeline against the REAL Nebius models.
//   npm run check:live
// Uses an in-memory store (never touches Firestore) and sends only the short
// scripted test messages below. Not part of `npm test` because it needs the
// network, spends a few dozen model calls, and model wording varies run to run
// — so it checks properties (language, escalation), not exact text.
process.env.FIREBASE_SERVICE_ACCOUNT_PATH = '/nonexistent/serviceAccount.json';
await import('dotenv/config');

const { processUserTurn, stampMessage } = await import('../src/services/conversationTurn.js');
const { isInLanguage } = await import('../src/utils/languageSupport.js');
const { saveConversation, getConversation } = await import('../src/services/firebaseService.js');

if (!process.env.NEBIUS_API_KEY || process.env.NEBIUS_API_KEY.startsWith('your_')) {
  console.error('NEBIUS_API_KEY is not set in backend/.env'); process.exit(1);
}

const DEV = /[ऀ-ॿ]/; const KN = /[ಀ-೿]/;
let failures = 0;
const check = (ok, label) => { console.log(`   ${ok ? 'PASS' : 'FAIL'}  ${label}`); if (!ok) failures += 1; };

async function start(language, id) {
  const welcome = stampMessage([], { role: 'assistant', content: 'welcome' });
  await saveConversation({ id, userId: 'live-check', language, userType: 'patient', messages: [welcome], extractedData: null, status: 'active' });
}
async function say(id, text, opts = {}) {
  const conversation = await getConversation(id);
  const out = await processUserTurn({ conversation, message: text, userType: 'patient', language: opts.language, inputMode: opts.inputMode });
  console.log(`\n   patient: ${text}\n   status : ${out.triage?.status} (${out.triage?.source})${out.isEmergency ? '  ** EMERGENCY **' : ''}\n   bot    : ${out.message}`);
  return out;
}
const scenario = (name) => console.log(`\n━━ ${name}`);

scenario('A. Hindi — dizziness must not be an emergency; follow-ups in Hindi');
await start('hi-IN', 'live-a');
let o = await say('live-a', 'मुझे चक्कर आ रहे हैं।');
check(!o.isEmergency, 'dizziness alone is not an emergency');
check(DEV.test(o.message), 'reply is in Hindi');
check(/\?|？|क्या|कब|कौन/.test(o.message), 'reply asks a follow-up question');
o = await say('live-a', 'नहीं, सिर्फ चक्कर आ रहे हैं।');
check(!o.isEmergency, 'after denying red flags, still not an emergency');
check(DEV.test(o.message), 'reply still in Hindi');
o = await say('live-a', 'कल रात से, Glycomet लेने के बाद।');
check(!o.isEmergency && DEV.test(o.message), 'continues collecting ADR details in Hindi');

scenario('B. Hindi — genuine emergency');
await start('hi-IN', 'live-b');
await say('live-b', 'मुझे चक्कर आ रहे हैं।');
o = await say('live-b', 'हाँ, मुझे सांस लेने में बहुत तकलीफ हो रही है।');
check(o.isEmergency, 'difficulty breathing → emergency');
check(DEV.test(o.message) && /112/.test(o.message) && /108/.test(o.message), 'advisory is in Hindi with 112/108');

scenario('B2. Hindi — emergency confirmed by answering "yes" to a screening question (needs the LLM + context)');
await start('hi-IN', 'live-b2');
await say('live-b2', 'मुझे चक्कर आ रहे हैं।');
o = await say('live-b2', 'हाँ, और सीने में भी दर्द है।');
check(o.isEmergency, 'chest pain with dizziness → emergency');

scenario('C. English');
await start('en-IN', 'live-c');
o = await say('live-c', 'I feel dizzy since morning');
check(!o.isEmergency && isInLanguage(o.message, 'en-IN'), 'English in, English out, no emergency');

scenario('D. Kannada');
await start('kn-IN', 'live-d');
o = await say('live-d', 'ನನಗೆ ತಲೆ ಸುತ್ತುತ್ತಿದೆ');
check(!o.isEmergency, 'dizziness is not an emergency');
check(KN.test(o.message), 'reply is in Kannada');

scenario('E. Mixed Hindi–English input, Hindi conversation');
await start('hi-IN', 'live-e');
o = await say('live-e', 'Mujhe Glycomet lene ke baad bahut dizziness ho rahi hai, kya karun?', { inputMode: 'voice' });
check(!o.isEmergency, 'not an emergency');
check(DEV.test(o.message), 'reply stays in Hindi');

console.log(`\n${failures ? `${failures} check(s) FAILED` : 'All live checks passed'}`);
process.exit(failures ? 1 : 0);
