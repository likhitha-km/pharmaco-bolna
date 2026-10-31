import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conversationReducer, initialState } from '../src/context/conversationReducer.js';
import { sortMessages, reconcileTurn, formatMessageTime, messageKey } from '../src/utils/messages.js';
import { LANGUAGES, SAFETY_STRINGS, tSafety } from '../src/utils/i18n.js';

// Pure-logic tests for the parts of the chat that decide ordering, time and
// language. (Component rendering is covered by running the app.)

const run = (actions, state = initialState) => actions.reduce(conversationReducer, state);
const server = (seq, role, content, ts) => ({ id: `id-${seq}`, seq, role, content, timestamp: ts });

// ── Scenario G: message ordering ─────────────────────────────────────────────

test('G: messages render in server sequence order regardless of arrival order or timestamps', () => {
  // Timestamps deliberately disagree with seq (e.g. a skewed client clock).
  const shuffled = [
    server(2, 'user', 'two', '2026-01-01T10:00:09.000Z'),
    server(0, 'assistant', 'zero', '2026-01-01T10:00:30.000Z'),
    server(1, 'user', 'one', '2026-01-01T10:00:01.000Z'),
  ];
  assert.deepEqual(sortMessages(shuffled).map((m) => m.content), ['zero', 'one', 'two']);
  assert.deepEqual(run([{ type: 'SET_MESSAGES', payload: shuffled }]).messages.map((m) => m.seq), [0, 1, 2]);
});

test('G: legacy history without seq keeps its stored order', () => {
  const legacy = [{ role: 'assistant', content: 'a', timestamp: 'z' }, { role: 'user', content: 'b', timestamp: 'a' }];
  assert.deepEqual(sortMessages(legacy).map((m) => m.content), ['a', 'b']);
});

test('G: provisional bubbles have no timestamp and are replaced by the server-stamped messages', () => {
  let s = run([
    { type: 'SET_MESSAGES', payload: [server(0, 'assistant', 'welcome', '2026-01-01T10:00:00.000Z')] },
    { type: 'ADD_MESSAGE', payload: { role: 'user', content: 'चक्कर', clientId: 'u1' } },
    { type: 'ADD_MESSAGE', payload: { role: 'assistant', content: '', clientId: 'b1', isLoading: true } },
  ]);
  const pending = s.messages.slice(1);
  assert.ok(pending.every((m) => m.timestamp === undefined), 'no made-up client time while pending');

  s = run([{
    type: 'RECONCILE_TURN',
    payload: {
      userClientId: 'u1', botClientId: 'b1',
      userMessage: server(1, 'user', 'चक्कर', '2026-01-01T10:00:05.000Z'),
      assistantMessage: server(2, 'assistant', 'क्या आपको सांस में तकलीफ है?', '2026-01-01T10:00:07.000Z'),
    },
  }], s);
  assert.deepEqual(s.messages.map((m) => m.seq), [0, 1, 2]);
  assert.equal(s.messages[2].isLoading, undefined);
  assert.equal(s.messages[2].timestamp, '2026-01-01T10:00:07.000Z');
  assert.ok(Date.parse(s.messages[2].timestamp) > Date.parse(s.messages[1].timestamp));
  // The React/speech key survives the swap, so the bubble does not remount.
  assert.equal(messageKey(s.messages[2], 2), 'b1');
});

test('G: replies that arrive out of order still land under the right message', () => {
  // Two sends in flight; the SECOND reply is delivered first.
  let s = run([
    { type: 'ADD_MESSAGE', payload: { role: 'user', content: 'first', clientId: 'u1' } },
    { type: 'ADD_MESSAGE', payload: { role: 'assistant', content: '', clientId: 'b1', isLoading: true } },
    { type: 'ADD_MESSAGE', payload: { role: 'user', content: 'second', clientId: 'u2' } },
    { type: 'ADD_MESSAGE', payload: { role: 'assistant', content: '', clientId: 'b2', isLoading: true } },
  ]);
  s = run([{ type: 'RECONCILE_TURN', payload: { userClientId: 'u2', botClientId: 'b2', userMessage: server(3, 'user', 'second', 't3'), assistantMessage: server(4, 'assistant', 'reply to second', 't4') } }], s);
  s = run([{ type: 'RECONCILE_TURN', payload: { userClientId: 'u1', botClientId: 'b1', userMessage: server(1, 'user', 'first', 't1'), assistantMessage: server(2, 'assistant', 'reply to first', 't2') } }], s);
  assert.deepEqual(s.messages.map((m) => m.content), ['first', 'reply to first', 'second', 'reply to second']);
});

test('a failed request shows a local error in the placeholder without inventing a timestamp', () => {
  const s = run([
    { type: 'ADD_MESSAGE', payload: { role: 'user', content: 'hi', clientId: 'u1' } },
    { type: 'ADD_MESSAGE', payload: { role: 'assistant', content: '', clientId: 'b1', isLoading: true } },
    { type: 'FAIL_TURN', payload: { botClientId: 'b1', content: 'err' } },
  ]);
  assert.equal(s.messages[1].content, 'err');
  assert.equal(s.messages[1].isLoading, false);
  assert.equal(s.messages[1].timestamp, undefined);
});

test('reconcileTurn without server messages leaves the list untouched', () => {
  const list = [{ role: 'user', content: 'x', clientId: 'u1' }];
  assert.deepEqual(reconcileTurn(list, { userClientId: 'u1' }), list);
});

// ── Timestamps: UTC in, viewer's local time out ─────────────────────────────

test('UTC timestamps display in the viewer\'s own timezone', () => {
  const iso = '2026-01-01T10:00:00.000Z';
  process.env.TZ = 'Asia/Kolkata';
  assert.match(formatMessageTime(iso, 'en-US'), /03:30/);
  process.env.TZ = 'America/New_York';
  assert.match(formatMessageTime(iso, 'en-US'), /05:00/);
  process.env.TZ = 'UTC';
  assert.match(formatMessageTime(iso, 'en-US'), /10:00/);
});

test('timestamp parsing is robust: no-zone strings are UTC, bad values are blank', () => {
  process.env.TZ = 'Asia/Kolkata';
  assert.match(formatMessageTime('2026-01-01T10:00:00', 'en-US'), /03:30/, 'a zone-less server timestamp is UTC, not local');
  assert.match(formatMessageTime({ seconds: Date.UTC(2026, 0, 1, 10) / 1000 }, 'en-US'), /03:30/);
  assert.equal(formatMessageTime(undefined), '');
  assert.equal(formatMessageTime('not a date'), '');
});

// ── Language: safety UI is complete in every language ───────────────────────

test('every supported language has the full set of safety strings, in its own script', () => {
  const keys = Object.keys(SAFETY_STRINGS['en-IN']);
  const script = { 'hi-IN': /[ऀ-ॿ]/, 'mr-IN': /[ऀ-ॿ]/, 'kn-IN': /[ಀ-೿]/, 'ta-IN': /[஀-௿]/, 'te-IN': /[ఀ-౿]/, 'bn-IN': /[ঀ-৿]/, 'gu-IN': /[઀-૿]/, 'ml-IN': /[ഀ-ൿ]/ };
  assert.deepEqual(LANGUAGES.map((l) => l.code).sort(), Object.keys(SAFETY_STRINGS).sort());
  for (const { code } of LANGUAGES) {
    for (const key of keys) {
      const value = SAFETY_STRINGS[code][key];
      assert.ok(value, `${code}.${key} missing`);
      if (script[code]) assert.match(value, script[code], `${code}.${key} should be in ${code}'s script`);
    }
    assert.match(SAFETY_STRINGS[code].connectionError, /112/);
    assert.match(SAFETY_STRINGS[code].connectionError, /108/);
    assert.match(SAFETY_STRINGS[code].nationalEmergency, /112/);
    assert.match(SAFETY_STRINGS[code].ambulance, /108/);
  }
});

test('safety strings never come back in the wrong language for a supported code', () => {
  assert.notEqual(tSafety('emergencyHeading', 'hi-IN'), tSafety('emergencyHeading', 'en-IN'));
  assert.match(tSafety('emergencyHeading', 'kn-IN'), /[ಀ-೿]/);
  assert.equal(tSafety('emergencyHeading', 'xx-XX'), tSafety('emergencyHeading', 'en-IN'));
});

test('switching language is explicit state and RESET restores the default', () => {
  const s = run([{ type: 'SET_LANGUAGE', payload: 'kn-IN' }]);
  assert.equal(s.language, 'kn-IN');
  assert.equal(run([{ type: 'RESET' }], s).language, initialState.language);
});

test('re-writing the welcome keeps its id, position and time; only the text changes', () => {
  const s = run([
    { type: 'SET_MESSAGES', payload: [server(0, 'assistant', 'नमस्ते', '2026-01-01T10:00:00.000Z')] },
    { type: 'REPLACE_MESSAGE', payload: { id: 'id-0', content: 'Hello' } },
  ]);
  assert.deepEqual(s.messages, [server(0, 'assistant', 'Hello', '2026-01-01T10:00:00.000Z')]);
  // A provisional (offline) welcome is found by its client id.
  const off = run([{ type: 'ADD_MESSAGE', payload: { role: 'assistant', content: 'a', clientId: 'c1' } }, { type: 'REPLACE_MESSAGE', payload: { clientId: 'c1', content: 'b' } }]);
  assert.equal(off.messages[0].content, 'b');
});
