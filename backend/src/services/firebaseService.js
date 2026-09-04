import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import dotenv from 'dotenv';
dotenv.config();

let db;

function disableProxyEnvironment() {
  const proxyKeys = ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'FTP_PROXY', 'RSYNC_PROXY', 'http_proxy', 'https_proxy', 'all_proxy', 'ftp_proxy', 'rsync_proxy', 'GRPC_PROXY', 'grpc_proxy'];
  proxyKeys.forEach((key) => delete process.env[key]);
  const noProxyValue = process.env.NO_PROXY || process.env.no_proxy || 'localhost,127.0.0.1,::1,*.local,.local';
  process.env.NO_PROXY = noProxyValue;
  process.env.no_proxy = noProxyValue;
}

function initFirebase() {
  disableProxyEnvironment();
  if (admin.apps.length === 0) {
    try {
      const serviceAccountPath = resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './firebase/serviceAccount.json');
      const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log('[Firebase] Initialized successfully');
      db = admin.firestore();
      
      // Test the connection to prevent hanging if Firestore isn't actually created
      db.collection('_health').doc('ping').set({ timestamp: Date.now() })
        .then(() => console.log('[Firebase] Firestore connected and ready!'))
        .catch(err => {
          console.warn('[Firebase] Firestore connected but write failed (check DB creation):', err.message);
          db = null;
        });
    } catch (err) {
      console.warn('[Firebase] Could not load service account — using demo mode (in-memory store). Error:', err.message);
      db = null;
    }
  } else {
    try {
        db = admin.firestore();
    } catch(e) {
        db = null;
    }
  }
}

initFirebase();

// ---- In-memory fallback store for demo mode ----
export const memStore = {
  conversations: {},
  reports: {},
  drug_signals: {},
  users: {},
};

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function normalizeUserId(userId) {
  return userId || 'anonymous';
}

function shouldIncludeReportForUser(report, userId) {
  // Strict ownership check — a report is only visible to the exact user
  // (or anonymous device id) that created it. No cross-user fallback.
  if (!report) return false;
  return normalizeUserId(report.userId) === normalizeUserId(userId);
}

function sortReportsByDate(reports) {
  return [...reports].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

function dedupeReports(reports) {
  return reports.filter((report, index, arr) => arr.findIndex((item) => item.id === report.id) === index);
}

/**
 * Firestore rejects any field whose value is `undefined` (e.g. an optional
 * field the caller never provided, like `icsr` before a draft has been
 * AI-generated). That used to make the whole document write throw, and the
 * write silently fell back to the in-memory store even though nothing was
 * actually wrong with the data — it just needed to be dropped, not sent.
 * This recursively strips `undefined` keys/array entries so a write only
 * ever fails for a genuine problem, not a missing-optional-field.
 */
function sanitizeForFirestore(value) {
  if (Array.isArray(value)) {
    return value.filter((item) => item !== undefined).map((item) => sanitizeForFirestore(item));
  }
  if (value !== null && typeof value === 'object') {
    const result = {};
    for (const [key, val] of Object.entries(value)) {
      if (val === undefined) continue;
      result[key] = sanitizeForFirestore(val);
    }
    return result;
  }
  return value;
}

// ---- CONVERSATIONS ----

export async function saveConversation(data) {
  const id = data.id || genId();
  const doc = sanitizeForFirestore({ ...data, id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  memStore.conversations[id] = doc;
  if (db) {
    try {
      await db.collection('conversations').doc(id).set(doc);
    } catch (error) {
      console.error('[Firebase] conversation write FAILED — kept in memory only, will not survive a restart:', error.message);
    }
  }
  return id;
}

export async function updateConversation(id, updates) {
  const upd = sanitizeForFirestore({ ...updates, updatedAt: new Date().toISOString() });
  if (memStore.conversations[id]) {
    memStore.conversations[id] = { ...memStore.conversations[id], ...upd };
  }
  if (db) {
    try {
      await db.collection('conversations').doc(id).set(upd, { merge: true });
    } catch (error) {
      console.error('[Firebase] conversation update FAILED — kept in memory only, will not survive a restart:', error.message);
    }
  }
}

export async function getConversation(id) {
  if (db) {
    const snap = await db.collection('conversations').doc(id).get();
    return snap.exists ? snap.data() : null;
  }
  return memStore.conversations[id] || null;
}

// ---- REPORTS ----

export async function saveReport(data) {
  const id = data.id || genId();
  const doc = sanitizeForFirestore({
    ...data,
    id,
    userId: normalizeUserId(data.userId),
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: data.updatedAt || new Date().toISOString(),
  });
  memStore.reports[id] = doc;
  if (db) {
    try {
      await db.collection('reports').doc(id).set(doc);
    } catch (error) {
      console.error('[Firebase] report write FAILED — kept in memory only, WILL NOT survive a restart:', error.message);
    }
  } else {
    console.error('[Firebase] report write skipped — no Firestore connection, in memory only');
  }
  return id;
}

export async function getReport(id) {
  if (db) {
    try {
      const snap = await db.collection('reports').doc(id).get();
      if (snap.exists) {
        return snap.data();
      }
    } catch (error) {
      console.warn('[Firebase] report lookup failed, using memory store:', error.message);
    }
  }
  return memStore.reports[id] || null;
}

export async function getAllReports(limit = 50) {
  let results = [];
  if (db) {
    try {
      const snap = await db.collection('reports').get();
      results = snap.docs.map((d) => d.data());
    } catch (error) {
      console.warn('[Firebase] report list query failed, using memory store:', error.message);
    }
  }

  const memoryResults = Object.values(memStore.reports);
  const merged = dedupeReports([...results, ...memoryResults]);
  return sortReportsByDate(merged).slice(0, limit);
}

export async function getUserReports(userId, limit = 20) {
  const normalizedUserId = normalizeUserId(userId);
  let results = [];
  if (db) {
    try {
      const snap = await db.collection('reports').get();
      results = snap.docs.map((d) => d.data());
    } catch (error) {
      console.warn('[Firebase] user report query failed, using memory store:', error.message);
    }
  }

  const memoryResults = Object.values(memStore.reports);
  const merged = dedupeReports([...results, ...memoryResults]);
  // Strict ownership only — never fall back to returning everyone's reports.
  const filtered = merged.filter((report) => shouldIncludeReportForUser(report, normalizedUserId));
  return sortReportsByDate(filtered).slice(0, limit);
}

export async function getReportsByConversationId(conversationId, limit = 20) {
  let results = [];
  if (db) {
    try {
      const snap = await db.collection('reports').get();
      results = snap.docs
        .map((d) => d.data())
        .filter((report) => report.conversationId === conversationId);
    } catch (error) {
      console.warn('[Firebase] conversation report query failed, using memory store:', error.message);
    }
  }

  const memoryResults = Object.values(memStore.reports).filter((r) => r.conversationId === conversationId);
  const merged = dedupeReports([...results, ...memoryResults]);
  return sortReportsByDate(merged).slice(0, limit);
}

// ---- DRUG SIGNALS ----

export async function updateDrugSignals(drugName, adrTerms = []) {
  const key = drugName.toLowerCase().replace(/\s+/g, '_');
  if (db) {
    const ref = db.collection('drug_signals').doc(key);
    const snap = await ref.get();
    const existing = snap.exists ? snap.data() : { drugName, adrCounts: {}, totalReports: 0 };
    const adrCounts = { ...existing.adrCounts };
    adrTerms.forEach((term) => {
      adrCounts[term] = (adrCounts[term] || 0) + 1;
    });
    await ref.set({ drugName, adrCounts, totalReports: (existing.totalReports || 0) + 1, lastUpdated: new Date().toISOString() });
  } else {
    if (!memStore.drug_signals[key]) {
      memStore.drug_signals[key] = { drugName, adrCounts: {}, totalReports: 0, lastUpdated: new Date().toISOString() };
    }
    const rec = memStore.drug_signals[key];
    adrTerms.forEach((term) => { rec.adrCounts[term] = (rec.adrCounts[term] || 0) + 1; });
    rec.totalReports++;
    rec.lastUpdated = new Date().toISOString();
  }
}

export async function getDrugSignals(drugName) {
  const key = drugName.toLowerCase().replace(/\s+/g, '_');
  if (db) {
    const snap = await db.collection('drug_signals').doc(key).get();
    return snap.exists ? snap.data() : null;
  }
  return memStore.drug_signals[key] || null;
}

export async function getAggregateSignals(limit = 20) {
  if (db) {
    const snap = await db.collection('drug_signals').orderBy('totalReports', 'desc').limit(limit).get();
    return snap.docs.map((d) => d.data());
  }
  return Object.values(memStore.drug_signals)
    .sort((a, b) => b.totalReports - a.totalReports)
    .slice(0, limit);
}

// ---- REAL AGGREGATE STATISTICS (no fabricated/random data) ----

export async function getRealPublicStats() {
  const [reports, signals] = await Promise.all([getAllReports(500), getAggregateSignals(100)]);

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${now.getMonth()}`;

  let reportsThisMonth = 0;
  const monthCounts = new Map();
  const reporterTypeCounts = {};
  const languageSet = new Set();
  let serious = 0;
  let nonSerious = 0;

  for (const report of reports) {
    const created = report.createdAt ? new Date(report.createdAt) : null;
    if (created && !Number.isNaN(created.getTime())) {
      const key = `${created.getFullYear()}-${created.getMonth()}`;
      monthCounts.set(key, (monthCounts.get(key) || 0) + 1);
      if (key === currentMonthKey) reportsThisMonth++;
    }

    const reporterType = report.extractedData?.metadata?.reporter_type;
    if (reporterType) reporterTypeCounts[reporterType] = (reporterTypeCounts[reporterType] || 0) + 1;

    if (report.language) languageSet.add(report.language);

    const isSerious = report.icsr?.seriousness === 'Serious' || report.meddraMapping?.seriousness?.is_serious === true;
    const isKnownNonSerious = report.icsr?.seriousness === 'Non-serious' || report.meddraMapping?.seriousness?.is_serious === false;
    if (isSerious) serious++;
    else if (isKnownNonSerious) nonSerious++;
  }

  const monthlyTrend = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    monthlyTrend.push({ month: d.toLocaleString('en-IN', { month: 'short' }), reports: monthCounts.get(key) || 0 });
  }

  const adrTotals = new Map();
  const topDrugs = signals
    .map((s) => {
      Object.entries(s.adrCounts || {}).forEach(([term, count]) => {
        adrTotals.set(term, (adrTotals.get(term) || 0) + count);
      });
      return { drug: s.drugName, reports: s.totalReports || 0 };
    })
    .sort((a, b) => b.reports - a.reports)
    .slice(0, 10);

  const commonAdrs = Array.from(adrTotals.entries())
    .map(([term, count]) => ({ term, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    total_reports: reports.length,
    reports_this_month: reportsThisMonth,
    drugs_with_signals: signals.length,
    languages_used: languageSet.size,
    reporter_type_distribution: reporterTypeCounts,
    serious_vs_nonserious: { serious, non_serious: nonSerious },
    common_adrs: commonAdrs,
    monthly_trend: monthlyTrend,
    top_drugs: topDrugs,
    // Pharmaco does not currently collect reporter location, so this is
    // intentionally empty rather than fabricated — see ADRHeatmap.jsx.
    geographic_distribution: [],
  };
}

export async function getPublicStats() {
  if (db) {
    const [convSnap, reportSnap, signalSnap] = await Promise.all([
      db.collection('conversations').get(),
      db.collection('reports').get(),
      db.collection('drug_signals').get(),
    ]);
    return {
      total_reports: reportSnap.size,
      total_conversations: convSnap.size,
      drugs_with_signals: signalSnap.size,
    };
  }
  return {
    total_reports: Object.keys(memStore.reports).length,
    total_conversations: Object.keys(memStore.conversations).length,
    drugs_with_signals: Object.keys(memStore.drug_signals).length,
  };
}
