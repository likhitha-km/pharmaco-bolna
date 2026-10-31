import { EventEmitter } from 'events';
import { memStore } from '../services/firebaseService.js';
import admin from 'firebase-admin';

// Voice call records + a live event bus that the Call Console subscribes to
// over SSE. Real Bolna calls (tool hits + status webhooks) and simulated demo
// calls both publish through here, so the UI can't tell them apart.

export const voiceBus = new EventEmitter();
voiceBus.setMaxListeners(100);

memStore.voice_calls = memStore.voice_calls || {};

function firestore() {
  try {
    return admin.apps.length ? admin.firestore() : null;
  } catch {
    return null;
  }
}

/** Caller numbers are PII — only the last 4 digits are ever stored or shown. */
export function maskPhone(phone) {
  if (!phone || typeof phone !== 'string') return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return null;
  return `•••• ${digits.slice(-4)}`;
}

export function getCall(callId) {
  return memStore.voice_calls[callId] || null;
}

export function listCalls(limit = 30) {
  return Object.values(memStore.voice_calls)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);
}

/** Create the call record if it doesn't exist yet, otherwise shallow-merge. */
export function upsertCall(callId, updates = {}) {
  const now = new Date().toISOString();
  const existing = memStore.voice_calls[callId];
  const next = existing
    ? { ...existing, ...updates, updatedAt: now }
    : {
        id: callId,
        status: 'queued',
        mode: 'intake',
        language: 'hi',
        source: 'bolna',
        transcript: [],
        events: [],
        toolCalls: [],
        createdAt: now,
        ...updates,
        updatedAt: now,
      };
  memStore.voice_calls[callId] = next;
  persist(next);
  if (!existing) voiceBus.emit('event', { callId, type: 'call.created', at: now, call: summarize(next) });
  return next;
}

/** Append a timeline event to the call and broadcast it. */
export function pushEvent(callId, type, data = {}) {
  const call = memStore.voice_calls[callId] || upsertCall(callId);
  const event = { type, at: new Date().toISOString(), ...data };
  call.events = [...(call.events || []), event].slice(-200);
  if (type === 'transcript.turn') {
    call.transcript = [...(call.transcript || []), { role: data.role, text: data.text, text_en: data.text_en || null, at: event.at }];
  }
  call.updatedAt = event.at;
  voiceBus.emit('event', { callId, ...event, call: summarize(call) });
  persist(call);
  return event;
}

export function summarize(call) {
  if (!call) return null;
  const { events, transcript, ...rest } = call;
  return rest;
}

let persistTimer = {};
function persist(call) {
  const db = firestore();
  if (!db) return;
  // Debounce — simulated calls emit many events per second.
  clearTimeout(persistTimer[call.id]);
  persistTimer[call.id] = setTimeout(() => {
    db.collection('voice_calls').doc(call.id).set(JSON.parse(JSON.stringify(call)))
      .catch((err) => console.warn('[VoiceStore] persist failed (kept in memory):', err.message));
  }, 500);
}

/** Load previously persisted calls so the console survives a restart. */
export async function hydrateCalls() {
  const db = firestore();
  if (!db) return;
  try {
    const snap = await db.collection('voice_calls').orderBy('createdAt', 'desc').limit(50).get();
    const staleBefore = Date.now() - 30 * 60 * 1000;
    snap.docs.forEach((d) => {
      const data = d.data();
      // A call still "live" from before a restart will never get its final
      // webhook processed by this process — show it as ended, not live.
      const live = ['queued', 'ringing', 'initiated', 'in-progress', 'call-disconnected'].includes(data.status);
      if (live && new Date(data.updatedAt).getTime() < staleBefore) data.status = 'ended';
      if (!memStore.voice_calls[data.id]) memStore.voice_calls[data.id] = data;
    });
  } catch (err) {
    console.warn('[VoiceStore] hydrate skipped:', err.message);
  }
}
