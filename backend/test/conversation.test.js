import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyTestEnv } from './helpers.js';

applyTestEnv();
const { detectRedFlags, triageMessage } = await import('../src/agents/triageAgent.js');
const { processUserTurn, withConversationLock, nextTimestamp, normalizeMessages, stampMessage } = await import('../src/services/conversationTurn.js');
const { buildSystemPrompt } = await import('../src/agents/conversationAgent.js');
const { EMERGENCY_MESSAGES, FALLBACK_MESSAGES, SUPPORTED_LANGUAGES, isInLanguage, emergencyMessage, fallbackMessage, normalizeLanguage, languageStyle, languageName } = await import('../src/utils/languageSupport.js');

// These tests use a scripted stand-in for the LLM so they are offline and
// deterministic. They verify OUR logic (triage rules, language enforcement,
// state, ordering) — not the quality of a real model's wording. For that, run
// `npm run check:live`, which talks to the real Nebius models.

const DEVANAGARI = /[\u0900-\u097F]/;
const KANNADA = /[\u0C80-\u0CFF]/;

/** Scripted LLM: routes by prompt so triage and the conversation agent can be driven separately. */
function fakeLlm({ triage, agent }) {
  const calls = { triage: [], agent: [] };
  const fn = async (system, messages) => {
    if (system.includes('clinical safety screener')) {
      calls.triage.push({ system, messages });
      const out = typeof triage === 'function' ? triage(calls.triage.length, messages) : triage;
      if (out instanceof Error) throw out;
      return JSON.stringify(out);
    }
    calls.agent.push({ system, messages });
    const out = typeof agent === 'function' ? agent(calls.agent.length, system, messages) : agent;
    if (out instanceof Error) throw out;
    return typeof out === 'string' ? out : JSON.stringify(out);
  };
  fn.calls = calls;
  return fn;
}

const NO_FLAGS = { red_flags: [], uncertain_red_flags: [], ruled_out: [], symptoms: ['dizziness'], screening_complete: false };
const reply = (assistant_message, extra = {}) => ({ assistant_message, fields: {}, missing_fields: [], report_ready: false, emergency: false, ...extra });

/** A conversation held in memory, driven turn by turn through the real pipeline. */
function harness({ language = 'hi-IN', llm, translate = async (t) => t, extract = async () => null } = {}) {
  const welcome = stampMessage([], { role: 'assistant', content: 'welcome' });
  const conv = { id: 'c1', userId: 'u', language, userType: 'patient', messages: [welcome], extractedData: null, status: 'active' };
  const update = async (_id, upd) => Object.assign(conv, upd);
  return {
    conv,
    say: (message, opts = {}) => processUserTurn(
      { conversation: conv, message, userType: 'patient', language: opts.language, inputMode: opts.inputMode },
      { llm, translate, extract: opts.extract || extract, mapMedDRA: async () => ({}), assess: async () => ({ completeness_score: 50 }), update },
    ),
  };
}

// ── Red-flag detection ───────────────────────────────────────────────────────

test('dizziness, headache, nausea and rash alone are not red flags in any language', () => {
  for (const text of [
    'मुझे चक्कर आ रहे हैं', 'mujhe chakkar aa rahe hain', 'I feel dizzy', 'I have a headache and nausea', 'a mild rash on my arm',
    'ನನಗೆ ತಲೆ ಸುತ್ತುತ್ತಿದೆ', 'எனக்கு தலைசுற்றல் இருக்கிறது', 'मुझे बेहोशी जैसा लग रहा है', 'I feel like I might faint', 'these tablets are good for benefits',
  ]) {
    const r = detectRedFlags(text);
    assert.deepEqual(r.present, [], `"${text}" must not be a red flag (got ${r.present})`);
  }
});

test('clear red flags are detected across languages', () => {
  const cases = [
    ['मुझे सांस लेने में तकलीफ हो रही है', 'breathing_difficulty'],
    ["I can't breathe", 'breathing_difficulty'],
    ['saans nahi aa rahi', 'breathing_difficulty'],
    ['ನನಗೆ ಉಸಿರಾಟದ ತೊಂದರೆ ಇದೆ', 'breathing_difficulty'],
    ['மூச்சு விட சிரமம் உள்ளது', 'breathing_difficulty'],
    ['my throat is closing', 'airway_or_face_swelling'],
    ['चेहरे पर सूजन आ गई है', 'airway_or_face_swelling'],
    ['मुझे सीने में दर्द है', 'chest_pain'],
    ['मैं बेहोश हो गया था', 'loss_of_consciousness'],
    ['I passed out this morning', 'loss_of_consciousness'],
    ['मुझे दौरा पड़ा', 'seizure'],
    ['उल्टी में खून आया', 'blood_in_vomit_or_stool'],
    ['my speech is slurred speech', 'stroke_signs'],
  ];
  for (const [text, flag] of cases) {
    assert.ok(detectRedFlags(text).present.includes(flag), `"${text}" should flag ${flag}`);
  }
});

test('negated red flags are not treated as present, but are not silently ignored either', () => {
  for (const text of ['सीने में दर्द नहीं है', 'no chest pain', 'सांस लेने में तकलीफ नहीं है']) {
    const r = detectRedFlags(text);
    assert.deepEqual(r.present, [], text);
    assert.ok(r.negated.length > 0, `${text} should be reported as negated so the LLM still reviews it`);
  }
  // Self-negating phrasing is an emergency, not a denial.
  assert.ok(detectRedFlags("no, I can't breathe").present.includes('breathing_difficulty'));
});

test('"नहीं, सिर्फ चक्कर आ रहे हैं" (answering a screening question) is not an emergency', async () => {
  const llm = fakeLlm({ triage: { ...NO_FLAGS, ruled_out: ['chest_pain', 'breathing_difficulty', 'loss_of_consciousness'], screening_complete: true }, agent: reply('ठीक है।') });
  const t = await triageMessage('नहीं, सिर्फ चक्कर आ रहे हैं', { language: 'hi-IN', llm });
  assert.equal(t.is_emergency, false);
  assert.equal(t.triage_status, 'non_emergency');
  assert.equal(t.screening_complete, true);
});

// ── Triage decisions ─────────────────────────────────────────────────────────

test('the model can only raise red flags from the fixed list — "dizziness" is not one', async () => {
  const llm = fakeLlm({ triage: { ...NO_FLAGS, red_flags: ['dizziness', 'serious_symptom'] }, agent: reply('x') });
  const t = await triageMessage('मुझे चक्कर आ रहे हैं', { language: 'hi-IN', llm });
  assert.equal(t.is_emergency, false);
  assert.equal(t.triage_status, 'non_emergency');
});

test('a "yes" to a screening question confirms the red flag using conversation context', async () => {
  const llm = fakeLlm({ triage: { ...NO_FLAGS, red_flags: ['breathing_difficulty'] }, agent: reply('x') });
  const history = [
    { role: 'user', content: 'मुझे चक्कर आ रहे हैं' },
    { role: 'assistant', content: 'क्या आपको सांस लेने में परेशानी भी हो रही है?' },
    { role: 'user', content: 'हाँ' },
  ];
  const t = await triageMessage('हाँ', { language: 'hi-IN', history, llm });
  assert.equal(t.is_emergency, true);
  assert.equal(t.emergency_message, EMERGENCY_MESSAGES['hi-IN']);
  // The prior question reached the model — that is how "हाँ" is understood.
  assert.match(llm.calls.triage[0].messages[0].content, /सांस लेने में परेशानी/);
});

test('when triage cannot run, status is undetermined — never "safe" and never a false alarm', async () => {
  const llm = fakeLlm({ triage: new Error('model down'), agent: reply('x') });
  const t = await triageMessage('मुझे चक्कर आ रहे हैं', { language: 'hi-IN', llm });
  assert.equal(t.triage_status, 'undetermined');
  assert.equal(t.is_emergency, false);
  assert.equal(t.source, 'unavailable');
});

test('a clear red flag escalates even if the LLM is down', async () => {
  const llm = fakeLlm({ triage: new Error('model down'), agent: reply('x') });
  const t = await triageMessage('मुझे सांस लेने में तकलीफ हो रही है', { language: 'hi-IN', llm });
  assert.equal(t.is_emergency, true);
  assert.equal(llm.calls.triage.length, 0, 'keyword path needs no LLM round-trip');
});

// ── Scenario A: Hindi conversation ───────────────────────────────────────────

test('A: Hindi dizziness gets Hindi follow-up questions, not an emergency', async () => {
  const llm = fakeLlm({
    triage: NO_FLAGS,
    agent: reply('बताने के लिए धन्यवाद। क्या चक्कर के साथ आपको बेहोशी जैसा लग रहा है, या सीने में दर्द या सांस में तकलीफ है?'),
  });
  const h = harness({ llm });
  const out = await h.say('मुझे चक्कर आ रहे हैं।');
  assert.equal(out.isEmergency, false);
  assert.equal(out.language, 'hi-IN');
  assert.match(out.message, DEVANAGARI);
  assert.ok(!out.assistantMessage.isEmergency);
  // The agent was told the language and that red-flag screening is still pending.
  const prompt = llm.calls.agent[0].system;
  assert.match(prompt, /FIXED: Hindi \(hi-IN\)/);
  assert.match(prompt, /Red-flag screening completed: NO/);
  assert.equal(h.conv.triage.status, 'non_emergency');
});

test('A: after the patient denies the red flags, the agent is told not to ask them again', async () => {
  let turn = 0;
  const llm = fakeLlm({
    triage: () => (++turn === 1 ? NO_FLAGS : { ...NO_FLAGS, ruled_out: ['chest_pain', 'loss_of_consciousness'], screening_complete: true }),
    agent: (n) => reply(n === 1 ? 'क्या आपको सीने में दर्द है?' : 'समझ गया। चक्कर कब से शुरू हुए?'),
  });
  const h = harness({ llm });
  await h.say('मुझे चक्कर आ रहे हैं');
  const second = await h.say('नहीं, सिर्फ चक्कर आ रहे हैं');
  assert.equal(second.isEmergency, false);
  const prompt = llm.calls.agent[1].system;
  assert.match(prompt, /already denied.*chest_pain/s);
  assert.match(prompt, /Red-flag screening completed: yes/);
  // Whole history, including the assistant's own question, reaches the model.
  assert.ok(llm.calls.agent[1].messages.some((m) => m.content === 'क्या आपको सीने में दर्द है?'));
});

// ── Scenario B: genuine emergency, in the selected language ──────────────────

test('B: difficulty breathing triggers an immediate advisory in the selected language', async () => {
  for (const [language, script] of [['hi-IN', DEVANAGARI], ['kn-IN', KANNADA]]) {
    const llm = fakeLlm({ triage: NO_FLAGS, agent: reply('should never be called') });
    const h = harness({ language, llm });
    const text = language === 'hi-IN' ? 'मुझे सांस लेने में तकलीफ हो रही है' : 'ನನಗೆ ಉಸಿರಾಟದ ತೊಂದರೆ ಇದೆ';
    const out = await h.say(text);
    assert.equal(out.isEmergency, true);
    assert.equal(out.message, EMERGENCY_MESSAGES[language]);
    assert.match(out.message, script);
    assert.match(out.message, /112/);
    assert.match(out.message, /108/);
    assert.equal(llm.calls.agent.length, 0, 'emergency advice must not wait for the conversation model');
    assert.equal(h.conv.messages.at(-1).isEmergency, true);
  }
});

test('every supported language has emergency advice and a fallback in its own script, with 112 and 108', () => {
  assert.equal(SUPPORTED_LANGUAGES.length, 9);
  for (const lang of SUPPORTED_LANGUAGES) {
    for (const bank of [EMERGENCY_MESSAGES, FALLBACK_MESSAGES]) {
      assert.ok(bank[lang], `${lang} missing`);
      assert.ok(isInLanguage(bank[lang], lang), `${lang} text must be in its own script`);
      assert.match(bank[lang], /112/);
      assert.match(bank[lang], /108/);
    }
  }
});

// ── Scenario C / D: language stays fixed ─────────────────────────────────────

test('C: an English conversation stays English', async () => {
  const llm = fakeLlm({ triage: NO_FLAGS, agent: reply('Thanks for telling me. Have you fainted, or do you have chest pain or trouble breathing?') });
  const h = harness({ language: 'en-IN', llm });
  const out = await h.say('I feel dizzy');
  assert.equal(out.language, 'en-IN');
  assert.match(out.message, /^Thanks/);
  assert.match(llm.calls.agent[0].system, /FIXED: English \(en-IN\)/);
});

test('D: a Kannada conversation stays Kannada, including the fallback', async () => {
  const llm = fakeLlm({ triage: NO_FLAGS, agent: reply('ಧನ್ಯವಾದಗಳು. ತಲೆ ಸುತ್ತುವುದು ಯಾವಾಗ ಶುರುವಾಯಿತು ಮತ್ತು ನಿಮಗೆ ಎದೆ ನೋವು ಇದೆಯೇ?') });
  const h = harness({ language: 'kn-IN', llm });
  const out = await h.say('ನನಗೆ ತಲೆ ಸುತ್ತುತ್ತಿದೆ');
  assert.match(out.message, KANNADA);
  assert.match(llm.calls.agent[0].system, /FIXED: Kannada \(kn-IN\)/);

  const down = harness({ language: 'kn-IN', llm: fakeLlm({ triage: NO_FLAGS, agent: new Error('boom') }) });
  const fb = await down.say('ನನಗೆ ತಲೆ ಸುತ್ತುತ್ತಿದೆ');
  assert.equal(fb.message, fallbackMessage('kn-IN'));
  assert.match(fb.message, KANNADA);
});

// ── Scenario E: mixed-language input ─────────────────────────────────────────

test('E: mixed Hindi–English input does not change the conversation language', async () => {
  const llm = fakeLlm({ triage: NO_FLAGS, agent: reply('समझ गया। Glycomet कब से ले रहे हैं और क्या चक्कर के साथ सीने में दर्द है?') });
  const h = harness({ llm });
  const out = await h.say('Mujhe Glycomet lene ke baad dizziness ho rahi hai, what should I do?', { inputMode: 'voice' });
  assert.equal(out.language, 'hi-IN');
  assert.equal(h.conv.language, 'hi-IN');
  assert.match(out.message, DEVANAGARI);
  assert.match(llm.calls.agent[0].system, /Hinglish or a mix of languages/);
});

test('E: if the model drifts into English it is retried, then translated, then replaced by a safe localized fallback', async () => {
  // 1. Retry succeeds.
  let n = 0;
  let llm = fakeLlm({ triage: NO_FLAGS, agent: () => reply(++n === 1 ? 'Thanks. Do you have chest pain or trouble breathing right now?' : 'धन्यवाद। क्या आपको अभी सीने में दर्द या सांस लेने में परेशानी है?') });
  let out = await harness({ llm }).say('mujhe chakkar aa rahe hain');
  assert.match(out.message, DEVANAGARI);
  assert.equal(llm.calls.agent.length, 2);
  assert.match(llm.calls.agent[1].system, /NOT in Hindi/);

  // 2. Retry still English → Sarvam translation rescues it.
  llm = fakeLlm({ triage: NO_FLAGS, agent: reply('Thanks. Do you have chest pain or trouble breathing right now?') });
  out = await harness({ llm, translate: async () => 'धन्यवाद। क्या आपको अभी सीने में दर्द या सांस लेने में परेशानी है?' }).say('mujhe chakkar aa rahe hain');
  assert.match(out.message, DEVANAGARI);

  // 3. Translation fails too → localized fallback, never the English text.
  llm = fakeLlm({ triage: NO_FLAGS, agent: reply('Thanks. Do you have chest pain or trouble breathing right now?') });
  out = await harness({ llm, translate: async (t) => t }).say('mujhe chakkar aa rahe hain');
  assert.equal(out.message, fallbackMessage('hi-IN'));
  assert.doesNotMatch(out.message, /Thanks/);
});

test('an explicit language change by the user is honoured and persisted — text alone never changes it', async () => {
  const llm = fakeLlm({ triage: NO_FLAGS, agent: (n) => reply(n === 1 ? 'Sure. Since when has it been happening?' : 'ठीक है। यह कब से हो रहा है?') });
  const h = harness({ language: 'en-IN', llm });
  await h.say('मुझे चक्कर आ रहे हैं');                       // Hindi text, English selected → still English
  assert.equal(h.conv.language, 'en-IN');
  const out = await h.say('3 दिन से', { language: 'hi-IN' });  // user picks Hindi in the selector
  assert.equal(h.conv.language, 'hi-IN');
  assert.match(out.message, DEVANAGARI);
  assert.equal(normalizeLanguage('hi'), 'hi-IN');
  assert.equal(normalizeLanguage('xx'), null);
});

// ── Scenario F: voice and text share one conversation ────────────────────────

test('F: starting by voice and continuing by typing keeps one coherent context', async () => {
  const llm = fakeLlm({ triage: NO_FLAGS, agent: (n) => reply(n === 1 ? 'क्या यह दवा लेने के बाद शुरू हुआ?' : 'ठीक है, और कितनी खुराक लेते हैं?') });
  const h = harness({ llm });
  await h.say('मुझे चक्कर आ रहे हैं', { inputMode: 'voice' });
  await h.say('हाँ, Glycomet के बाद', { inputMode: 'text' });
  const users = h.conv.messages.filter((m) => m.role === 'user');
  assert.equal(users[0].isVoice, true);
  assert.equal(users[1].isVoice, undefined);
  const sent = llm.calls.agent[1].messages.map((m) => m.content);
  assert.deepEqual(sent.slice(1), ['मुझे चक्कर आ रहे हैं', 'क्या यह दवा लेने के बाद शुरू हुआ?', 'हाँ, Glycomet के बाद']);
});

// ── Scenario G: ordering & timestamps ────────────────────────────────────────

test('G: timestamps are UTC, strictly increasing, and seq gives a stable order', async () => {
  const llm = fakeLlm({ triage: NO_FLAGS, agent: reply('ठीक है।') });
  const h = harness({ llm });
  for (const m of ['एक', 'दो', 'तीन']) await h.say(m);
  const msgs = h.conv.messages;
  assert.equal(msgs.length, 7);
  msgs.forEach((m, i) => {
    assert.equal(m.seq, i);
    assert.match(m.timestamp, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/, 'UTC ISO-8601');
    assert.ok(m.id);
    if (i) assert.ok(Date.parse(m.timestamp) > Date.parse(msgs[i - 1].timestamp), `message ${i} must be later than ${i - 1}`);
  });
  // The assistant reply is always stamped after the user message it answers,
  // and the response returns both so the client never has to invent times.
  const out = await h.say('चार');
  assert.ok(Date.parse(out.assistantMessage.timestamp) > Date.parse(out.userMessage.timestamp));
});

test('G: nextTimestamp never goes backwards, even against a timestamp from the future', () => {
  const future = new Date(Date.now() + 60_000).toISOString();
  assert.ok(Date.parse(nextTimestamp(future)) > Date.parse(future));
  assert.ok(nextTimestamp(undefined));
});

test('G: legacy messages without id/seq are normalized in stored order', () => {
  const out = normalizeMessages([{ role: 'assistant', content: 'a', timestamp: 't1' }, { role: 'user', content: 'b', timestamp: 't0' }]);
  assert.deepEqual(out.map((m) => m.content), ['a', 'b']);
  assert.deepEqual(out.map((m) => m.seq), [0, 1]);
  assert.ok(out.every((m) => m.id));
});

test('G: overlapping turns for one conversation run in arrival order, not completion order', async () => {
  const order = [];
  const slow = withConversationLock('same', async () => { await new Promise((r) => setTimeout(r, 60)); order.push('first'); return 1; });
  const fast = withConversationLock('same', async () => { order.push('second'); return 2; });
  const other = withConversationLock('different', async () => { order.push('other'); });
  await Promise.all([slow, fast, other]);
  assert.deepEqual(order, ['other', 'first', 'second']);
  // A failing turn must not block the ones queued behind it.
  const bad = withConversationLock('same', async () => { throw new Error('x'); });
  const after = withConversationLock('same', async () => 'ok');
  await assert.rejects(bad);
  assert.equal(await after, 'ok');
});

test('G: two simultaneous messages both end up in the saved history, in order', async () => {
  const llm = fakeLlm({ triage: NO_FLAGS, agent: reply('ठीक है।') });
  const h = harness({ llm });
  const turn = (text) => withConversationLock('c1', () => h.say(text));
  await Promise.all([turn('पहला'), turn('दूसरा')]);
  assert.deepEqual(h.conv.messages.filter((m) => m.role === 'user').map((m) => m.content), ['पहला', 'दूसरा']);
  assert.equal(h.conv.messages.length, 5);
});

// ── Continuity & safety guards ───────────────────────────────────────────────

test('known information is given to the agent so it does not ask again', async () => {
  const extract = async () => ({ suspected_medicines: [{ name: 'Metformin', dosage: '500 mg' }], adverse_reactions: [{ original_text: 'dizziness', onset_date: 'yesterday' }] });
  const llm = fakeLlm({ triage: NO_FLAGS, agent: reply('ठीक है।') });
  await harness({ llm, extract }).say('Metformin 500 mg से कल से चक्कर');
  assert.match(llm.calls.agent[0].system, /Suspected medicine: Metformin/);
  assert.match(llm.calls.agent[0].system, /Dosage: 500 mg/);
});

test('the server does not accept "report ready" until the required fields exist', async () => {
  const early = fakeLlm({ triage: NO_FLAGS, agent: reply('यह आपकी रिपोर्ट का सारांश है।', { report_ready: true }) });
  const out = await harness({ llm: early }).say('चक्कर');
  assert.equal(out.isReportReady, false);

  const extract = async () => ({ suspected_medicines: [{ name: 'Metformin' }], adverse_reactions: [{ original_text: 'dizziness', onset_date: 'yesterday' }] });
  const ready = fakeLlm({ triage: NO_FLAGS, agent: reply('यह आपकी रिपोर्ट का सारांश है।', { report_ready: true }) });
  assert.equal((await harness({ llm: ready, extract }).say('Metformin से कल से चक्कर')).isReportReady, true);
});

test('the conversation model cannot override a triage "no red flag", but can escalate when triage is undetermined', async () => {
  const blocked = fakeLlm({ triage: NO_FLAGS, agent: reply('कृपया 112 पर कॉल करें', { emergency: true }) });
  assert.equal((await harness({ llm: blocked }).say('मुझे चक्कर आ रहे हैं')).isEmergency, false);

  const undetermined = fakeLlm({ triage: new Error('down'), agent: reply('कृपया 112 पर कॉल करें', { emergency: true }) });
  const out = await harness({ llm: undetermined }).say('मुझे चक्कर आ रहे हैं');
  assert.equal(out.isEmergency, true);
  assert.equal(out.message, emergencyMessage('hi-IN'));
});

test('the prompt tells the model never to call symptoms harmless and to screen before collecting details', () => {
  const p = buildSystemPrompt('patient', 'hi-IN', null, null);
  assert.match(p, /NEVER judge or reassure about how serious things are/);
  assert.match(p, /no serious symptoms/);
  assert.match(p, /Do this BEFORE asking for report details/);
  assert.match(p, /ONE focused question per reply/);
  assert.match(p, /ONE short, natural screening question/);
  assert.match(p, /Never translate English phrasing word for word/);
  assert.doesNotMatch(p, /follow them/, 'the old "follow the user\'s language" rule must be gone');
});

test('every language gets its own spoken-register guidance, without touching the clinical rules', () => {
  for (const lang of SUPPORTED_LANGUAGES) {
    const p = buildSystemPrompt('patient', lang, null, null);
    assert.match(p, /VOICE & TONE/);
    assert.ok(p.includes(languageStyle(lang)), `${lang} style guide missing`);
    // Clinical behaviour is unchanged by tone work.
    assert.match(p, /Red flags that DO make it an emergency: trouble breathing/);
    assert.match(p, /Set report_ready=true only when the 3 REQUIRED fields/);
    assert.match(p, /NEVER judge or reassure/);
    assert.match(p, new RegExp(`FIXED: ${languageName(lang)} \\(${lang}\\)`));
  }
  assert.match(languageStyle('kn-IN'), /ಆಡುಮಾತು/);
  assert.match(languageStyle('hi-IN'), /Avoid gendered first-person/);
});
