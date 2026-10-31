#!/usr/bin/env node
// Clears Pharmaco Voice data from Firestore — e.g. before recording a demo.
//
//   npm run voice:reset                 # demo (simulated) calls + their reports only
//   npm run voice:reset -- --all-voice  # every phone-channel call and report
//   add --dry-run to see what would change without writing anything
//
// Drug-safety signals touched by the deleted reports are recomputed from the
// reports that remain, so signal counts stay truthful.

import 'dotenv/config';
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const dryRun = process.argv.includes('--dry-run');
const allVoice = process.argv.includes('--all-voice');

const sa = JSON.parse(readFileSync(resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './firebase/serviceAccount.json'), 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const signalKey = (name) => name.toLowerCase().replace(/\s+/g, '_');

const isTarget = (r) =>
  allVoice
    ? r.channel === 'voice' || r.demo === true || String(r.conversationId || '').startsWith('seed-')
    : r.demo === true || String(r.conversationId || '').startsWith('seed-');

const reports = (await db.collection('reports').get()).docs.map((d) => d.data());
const doomed = reports.filter(isTarget);
const kept = reports.filter((r) => !isTarget(r));

const calls = (await db.collection('voice_calls').get()).docs.map((d) => d.data());
const doomedCalls = calls.filter((c) => allVoice || c.source === 'simulation');
const doomedConvs = new Set(doomed.map((r) => r.conversationId).filter(Boolean));
doomedCalls.forEach((c) => doomedConvs.add(`voice-${c.id}`));

// Recompute signals for every drug a deleted report mentioned.
const affected = new Set();
doomed.forEach((r) => (r.extractedData?.suspected_medicines || []).forEach((m) => m?.name && affected.add(signalKey(m.name))));
const recomputed = {};
for (const key of affected) recomputed[key] = { adrCounts: {}, totalReports: 0, drugName: null };
for (const r of kept) {
  if (r.status !== 'submitted') continue;
  const terms = r.meddraMapping?.meddra_mappings?.map((m) => m.preferred_term) || [];
  for (const m of r.extractedData?.suspected_medicines || []) {
    const key = m?.name && signalKey(m.name);
    if (!key || !recomputed[key]) continue;
    const rec = recomputed[key];
    rec.drugName = rec.drugName || m.name;
    rec.totalReports++;
    terms.forEach((t) => (rec.adrCounts[t] = (rec.adrCounts[t] || 0) + 1));
  }
}

console.log(`${dryRun ? '[dry run] ' : ''}Deleting ${doomed.length} report(s), ${doomedCalls.length} call(s), ${doomedConvs.size} conversation(s).`);
for (const [key, rec] of Object.entries(recomputed)) {
  const before = (await db.collection('drug_signals').doc(key).get()).data();
  console.log(`  signal ${key}: ${before?.totalReports ?? 0} → ${rec.totalReports}`, rec.totalReports ? JSON.stringify(rec.adrCounts) : '(removed)');
}
if (dryRun) process.exit(0);

const batch = db.batch();
doomed.forEach((r) => batch.delete(db.collection('reports').doc(r.id)));
doomedCalls.forEach((c) => batch.delete(db.collection('voice_calls').doc(c.id)));
doomedConvs.forEach((id) => batch.delete(db.collection('conversations').doc(id)));
for (const [key, rec] of Object.entries(recomputed)) {
  const ref = db.collection('drug_signals').doc(key);
  if (rec.totalReports === 0) batch.delete(ref);
  else batch.set(ref, { drugName: rec.drugName, adrCounts: rec.adrCounts, totalReports: rec.totalReports, lastUpdated: new Date().toISOString() });
}
await batch.commit();
console.log('Done. Restart the backend so its in-memory cache matches.');
process.exit(0);
