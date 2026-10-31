// Prints a short multi-turn conversation per language against the REAL Nebius
// models so the tone can be read by a person. In-memory store, never Firestore.
//   npm run check:tone
process.env.FIREBASE_SERVICE_ACCOUNT_PATH = '/nonexistent/serviceAccount.json';
await import('dotenv/config');
const { processUserTurn, stampMessage } = await import('../src/services/conversationTurn.js');
const { saveConversation, getConversation } = await import('../src/services/firebaseService.js');
const { isInLanguage } = await import('../src/utils/languageSupport.js');

const SCRIPTS = {
  'hi-IN': ['मुझे चक्कर आ रहे हैं', 'नहीं, बस चक्कर आ रहे हैं', 'कल रात से, Glycomet लेने के बाद', '500 वाली, दिन में दो बार'],
  'kn-IN': ['ನನಗೆ ತಲೆ ಸುತ್ತುತ್ತಿದೆ', 'ಇಲ್ಲ, ಬರೀ ತಲೆ ಸುತ್ತು ಅಷ್ಟೇ', 'ನಿನ್ನೆ ರಾತ್ರಿಯಿಂದ, ಮಾತ್ರೆ ತೊಗೊಂಡ ಮೇಲೆ', 'Glycomet 500, ದಿನಕ್ಕೆ ಎರಡು ಸಲ'],
  'en-IN': ['I feel dizzy since morning', 'No, just dizzy', 'Started after I took Glycomet last night', '500 mg, twice a day'],
};
const only = process.argv[2];
let bad = 0;
for (const [lang, turns] of Object.entries(SCRIPTS)) {
  if (only && !lang.startsWith(only)) continue;
  const id = `tone-${lang}`;
  await saveConversation({ id, userId: 'tone-check', language: lang, userType: 'patient', messages: [stampMessage([], { role: 'assistant', content: 'welcome' })], extractedData: null, status: 'active' });
  console.log(`\n━━ ${lang}`);
  for (const t of turns) {
    const out = await processUserTurn({ conversation: await getConversation(id), message: t, userType: 'patient', language: lang });
    const words = out.message.split(/\s+/).length, q = (out.message.match(/[?？]/g) || []).length;
    console.log(`\n  patient: ${t}\n  bot    : ${out.message}\n           [${words} words, ${q} question mark(s), ${out.isEmergency ? 'EMERGENCY' : out.triage.status}]`);
    if (out.isEmergency || !isInLanguage(out.message, lang)) bad += 1;
  }
}
console.log(bad ? `\n${bad} reply/replies were an emergency or in the wrong language` : '\nAll replies in the right language, none escalated');
process.exit(bad ? 1 : 0);
