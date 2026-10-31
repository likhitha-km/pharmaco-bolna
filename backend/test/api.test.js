import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, api, waitFor } from './helpers.js';

// Integration tests against the real Express server with every external
// service disabled (see helpers.js). Bolna is simulated with fake webhook and
// tool requests; LLM-dependent steps exercise their documented fallbacks.

let server;
const KEY = { Authorization: 'Bearer test-secret' };
const WEBHOOK = '/api/voice/webhook?key=test-secret';

before(async () => { server = await startServer(4199); });
after(() => server?.stop());

const call = (id) => api(server.base, `/api/voice/calls/${id}`).then((r) => r.json);

// ── Chat ──────────────────────────────────────────────────────────────────────

test('chat: dictated messages are stored as voice; typed ones are not', async () => {
  const user = { 'X-User-Id': 'user-voice-test' };
  const start = await api(server.base, '/api/conversation/start', { method: 'POST', headers: user, body: { language: 'hi-IN' } });
  assert.equal(start.status, 200);
  const { conversationId } = start.json;

  const spoken = await api(server.base, '/api/conversation/message', { method: 'POST', headers: user, body: { conversationId, message: 'Glycomet lene ke baad chakkar aa rahe hain', inputMode: 'voice' } });
  assert.equal(spoken.status, 200);
  assert.ok(spoken.json.message, 'assistant replied (fallback reply when no LLM)');
  await api(server.base, '/api/conversation/message', { method: 'POST', headers: user, body: { conversationId, message: 'teen din se' } });

  const history = await api(server.base, `/api/conversation/history/${conversationId}`, { headers: user });
  const userMsgs = history.json.messages.filter((m) => m.role === 'user');
  assert.equal(userMsgs[0].isVoice, true);
  assert.equal(userMsgs[1].isVoice, undefined);
});

test('chat: emergency symptoms get immediate 112/108 guidance', async () => {
  const user = { 'X-User-Id': 'user-emergency-test' };
  const { json: { conversationId } } = await api(server.base, '/api/conversation/start', { method: 'POST', headers: user, body: { language: 'en-IN' } });
  const res = await api(server.base, '/api/conversation/message', { method: 'POST', headers: user, body: { conversationId, message: "After the injection my throat is closing and I can't breathe", inputMode: 'voice' } });
  assert.equal(res.json.isEmergency, true);
  assert.match(res.json.message, /112/);
  assert.match(res.json.message, /108/);
});

test('chat: changing language rewrites the welcome message until the patient has spoken', async () => {
  const user = { 'X-User-Id': 'user-lang-test' };
  const { json: start } = await api(server.base, '/api/conversation/start', { method: 'POST', headers: user, body: { language: 'hi-IN' } });
  const id = start.conversationId;
  assert.match(start.welcomeMessage, /[ऀ-ॿ]/);

  const toEn = await api(server.base, `/api/conversation/${id}/language`, { method: 'PUT', headers: user, body: { language: 'en-IN' } });
  assert.equal(toEn.status, 200);
  assert.equal(toEn.json.language, 'en-IN');
  assert.match(toEn.json.welcome.content, /^Hi there/);
  assert.equal(toEn.json.welcome.id, start.welcome.id, 'same message, new text');
  const kn = await api(server.base, `/api/conversation/${id}/language`, { method: 'PUT', headers: user, body: { language: 'kn-IN' } });
  assert.match(kn.json.welcome.content, /[ಀ-೿]/);

  let history = (await api(server.base, `/api/conversation/history/${id}`, { headers: user })).json;
  assert.equal(history.language, 'kn-IN');
  assert.equal(history.messages.length, 1);
  assert.match(history.messages[0].content, /[ಀ-೿]/);

  // Once the patient has said something, earlier messages are history.
  await api(server.base, '/api/conversation/message', { method: 'POST', headers: user, body: { conversationId: id, message: 'ನನಗೆ ತಲೆ ಸುತ್ತುತ್ತಿದೆ' } });
  const later = await api(server.base, `/api/conversation/${id}/language`, { method: 'PUT', headers: user, body: { language: 'ta-IN' } });
  assert.equal(later.json.welcome, null);
  history = (await api(server.base, `/api/conversation/history/${id}`, { headers: user })).json;
  assert.equal(history.language, 'ta-IN');
  assert.match(history.messages[0].content, /[ಀ-೿]/, 'the original welcome is left as it was');

  assert.equal((await api(server.base, `/api/conversation/${id}/language`, { method: 'PUT', headers: user, body: { language: 'xx' } })).status, 400);
  assert.equal((await api(server.base, `/api/conversation/${id}/language`, { method: 'PUT', headers: { 'X-User-Id': 'someone-else' }, body: { language: 'hi-IN' } })).status, 404);
});

test('chat: a saved conversation can only be resumed by its owner', async () => {
  const owner = { 'X-User-Id': 'owner-1' };
  const { json: { conversationId } } = await api(server.base, '/api/conversation/start', { method: 'POST', headers: owner, body: {} });
  assert.equal((await api(server.base, `/api/conversation/history/${conversationId}`, { headers: owner })).status, 200);
  assert.equal((await api(server.base, `/api/conversation/history/${conversationId}`, { headers: { 'X-User-Id': 'someone-else' } })).status, 404);
});

test('chat: save & finish later creates a draft listed in My Reports', async () => {
  const user = { 'X-User-Id': 'draft-user' };
  const { json: { conversationId } } = await api(server.base, '/api/conversation/start', { method: 'POST', headers: user, body: {} });
  const extractedData = { suspected_medicines: [{ name: 'Metformin' }], adverse_reactions: [{ original_text: 'chakkar' }] };
  const saved = await api(server.base, '/api/report/draft', { method: 'POST', headers: user, body: { conversationId, extractedData, completenessScore: 21, language: 'hi-IN' } });
  assert.equal(saved.status, 200);
  const mine = await api(server.base, '/api/report/my-reports', { headers: user });
  const draft = mine.json.reports.find((r) => r.conversationId === conversationId);
  assert.equal(draft.status, 'draft');
  const theirs = await api(server.base, '/api/report/my-reports', { headers: { 'X-User-Id': 'not-the-owner' } });
  assert.equal(theirs.json.reports.some((r) => r.conversationId === conversationId), false);
});

test('reports: deleting a draft really removes it (and its chat); only the owner can', async () => {
  const me = { 'X-User-Id': 'del-owner' };
  const other = { 'X-User-Id': 'del-intruder' };
  const { json: { conversationId } } = await api(server.base, '/api/conversation/start', { method: 'POST', headers: me, body: {} });
  const { json: { reportId } } = await api(server.base, '/api/report/draft', { method: 'POST', headers: me, body: { conversationId, extractedData: { suspected_medicines: [{ name: 'Metformin' }], adverse_reactions: [{ original_text: 'dizzy' }] } } });
  const ids = async () => (await api(server.base, '/api/report/my-reports', { headers: me })).json.reports.map((r) => r.id);
  assert.ok((await ids()).includes(reportId));

  // Somebody else cannot delete it — and cannot tell it exists.
  assert.equal((await api(server.base, `/api/report/${reportId}`, { method: 'DELETE', headers: other })).status, 404);
  assert.ok((await ids()).includes(reportId), 'still there after the intruder tried');

  const del = await api(server.base, `/api/report/${reportId}`, { method: 'DELETE', headers: me });
  assert.equal(del.status, 200);
  assert.equal(del.json.mode, 'deleted');
  assert.ok(!(await ids()).includes(reportId), 'gone from My Reports');
  assert.equal((await api(server.base, `/api/report/${reportId}`, { headers: me })).status, 404, 'no longer fetchable');
  assert.equal((await api(server.base, `/api/conversation/history/${conversationId}`, { headers: me })).status, 404, 'its chat is deleted too');
  assert.equal((await api(server.base, `/api/report/${reportId}`, { method: 'DELETE', headers: me })).status, 404, 'deleting twice is a clean 404');
});

test('reports: a submitted report is withdrawn from the list but kept on file', async () => {
  const me = { 'X-User-Id': 'del-owner-2' };
  const { json: { conversationId } } = await api(server.base, '/api/conversation/start', { method: 'POST', headers: me, body: {} });
  const { json: { reportId } } = await api(server.base, '/api/report/draft', { method: 'POST', headers: me, body: { conversationId, extractedData: { suspected_medicines: [{ name: 'Metformin' }] } } });
  await api(server.base, `/api/report/${reportId}`, { method: 'PUT', headers: me, body: { status: 'submitted' } });

  const del = await api(server.base, `/api/report/${reportId}`, { method: 'DELETE', headers: me });
  assert.equal(del.json.mode, 'withdrawn');
  const list = (await api(server.base, '/api/report/my-reports', { headers: me })).json.reports;
  assert.ok(!list.some((r) => r.id === reportId), 'hidden from the owner');
  const kept = await api(server.base, `/api/report/${reportId}`, { headers: me });
  assert.equal(kept.json.status, 'withdrawn', 'still on file');
});

test('chat: transcription never returns a mock transcript', async () => {
  const empty = await api(server.base, '/api/conversation/transcribe', { method: 'POST', body: new FormData() });
  assert.equal(empty.status, 400);
  const form = new FormData();
  form.append('audio', new Blob([new Uint8Array(2048)], { type: 'audio/webm' }), 'speech.webm');
  form.append('language', 'hi-IN');
  const res = await api(server.base, '/api/conversation/transcribe', { method: 'POST', body: form });
  assert.equal(res.status, 503);
  assert.equal(res.json.code, 'stt_not_configured');
  assert.equal(res.json.transcript, undefined);
});

// ── Phone channel: Bolna tools + webhooks (faked) ─────────────────────────────

test('voice: tools and webhook reject requests without the shared secret', async () => {
  assert.equal((await api(server.base, '/api/voice/tools/check-emergency', { method: 'POST', body: { symptoms: 'x' } })).status, 401);
  assert.equal((await api(server.base, '/api/voice/webhook', { method: 'POST', body: { id: 'x', status: 'completed' } })).status, 401);
  assert.equal((await api(server.base, '/api/voice/tools/lookup-medicine?medicine_name=Dolo', { headers: KEY })).json.generic_name, 'Paracetamol');
});

test('voice: webhook lifecycle processes a completed call exactly once', async () => {
  const id = 'exec-test-1';
  await api(server.base, WEBHOOK, { method: 'POST', body: { id, agent_id: 'ag', status: 'in-progress', user_number: '+919845012345' } });
  const filed = await api(server.base, '/api/voice/tools/file-report', {
    method: 'POST', headers: KEY,
    body: { execution_id: id, call_language: 'kn', medicine_name: 'Dolo 650', reaction_description: 'skin rash and itching', onset: '%(onset)s', patient_age: '34' },
  });
  assert.match(filed.json.report_id, /^PVP-[0-9A-F]{8}$/);

  await api(server.base, WEBHOOK, { method: 'POST', body: { id, status: 'call-disconnected', conversation_duration: 0 } });
  assert.equal((await call(id)).call.processed, undefined, 'call-disconnected must not trigger processing');

  const completed = { id, status: 'completed', conversation_duration: 94, transcript: 'assistant: Namaskara\nuser: Dolo 650 tagonda mele turike bantu\n', telephony_data: { recording_url: 'https://example.test/rec.mp3' } };
  await api(server.base, WEBHOOK, { method: 'POST', body: completed });
  await api(server.base, WEBHOOK, { method: 'POST', body: completed }); // duplicate delivery

  const done = await waitFor(async () => {
    const c = (await call(id)).call;
    return c.events.some((e) => e.type === 'call.ended') && c;
  }, { label: 'call processed' });
  assert.equal(done.language, 'kn');
  assert.equal(done.callerMasked, '•••• 2345');
  assert.equal(done.recordingUrl, 'https://example.test/rec.mp3');
  assert.equal(done.events.filter((e) => e.step === 'extract').length, 1, 'processed once despite duplicate webhook');
  const { report } = await call(id);
  assert.equal(report.extractedData.suspected_medicines[0].name, 'Paracetamol');
  assert.equal(report.channel, 'voice');
});

test('voice: emergency tool answers instantly for red-flag symptoms', async () => {
  const res = await api(server.base, '/api/voice/tools/check-emergency', { method: 'POST', headers: KEY, body: { execution_id: 'exec-test-2', symptoms: "throat is closing, can't breathe" } });
  assert.equal(res.json.is_emergency, true);
  assert.match(res.json.instruction, /108/);
});

test('voice: assisted follow-up calls require explicit consent', async () => {
  const res = await api(server.base, '/api/voice/call', { method: 'POST', body: { phone: '9845012345', mode: 'followup', reportId: 'PVP-X' } });
  assert.equal(res.status, 400);
  assert.equal(res.json.code, 'consent_required');
});

// ── The four demo scenarios, end to end ──────────────────────────────────────

test('demo: all four scripted calls run end to end', { timeout: 180000 }, async () => {
  const ids = {};
  for (const scenarioId of ['hi-metformin', 'ta-amoxicillin', 'hi-emergency', 'hi-followup']) {
    const res = await api(server.base, '/api/voice/simulate', { method: 'POST', body: { scenarioId, speed: 4 } });
    assert.equal(res.status, 200, scenarioId);
    ids[scenarioId] = res.json.callId;
  }
  const results = {};
  for (const [scenarioId, id] of Object.entries(ids)) {
    results[scenarioId] = await waitFor(async () => {
      const data = await call(id);
      return data.call.events.some((e) => e.type === 'call.ended') && data.call.icsrReady && data;
    }, { timeoutMs: 150000, intervalMs: 500, label: `${scenarioId} to finish` });
  }

  const metformin = results['hi-metformin'];
  assert.equal(metformin.report.extractedData.suspected_medicines[0].name, 'Metformin');
  assert.equal(metformin.report.extractedData.suspected_medicines[0].brand_name, 'Glycomet');
  assert.ok(metformin.call.events.some((e) => e.type === 'tool.result' && e.tool === 'lookup_medicine' && e.result.generic_name === 'Metformin'));
  assert.ok(metformin.report.icsr, 'ICSR generated');
  assert.equal(metformin.report.demo, true);

  assert.equal(results['ta-amoxicillin'].report.extractedData.suspected_medicines[0].name, 'Amoxicillin');
  assert.equal(results['ta-amoxicillin'].call.language, 'ta');

  const emergency = results['hi-emergency'];
  assert.equal(emergency.call.emergency, true);
  assert.equal(emergency.report.icsr.seriousness, 'Serious');
  assert.equal(emergency.report.extractedData.suspected_medicines[0].name, 'Diclofenac');
  assert.ok(emergency.report.extractedData.adverse_reactions.every((r) => r.severity === 'severe'));

  const followup = results['hi-followup'];
  assert.ok(followup.call.completeness > followup.call.completenessBefore, `completeness ${followup.call.completenessBefore} → ${followup.call.completeness}`);
  assert.equal(followup.report.icsr.report_type, 'Follow-up');
});
