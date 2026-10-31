import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const drugs = JSON.parse(readFileSync(resolve(__dirname, '../data/drugs.json'), 'utf8'));
const alerts = JSON.parse(readFileSync(resolve(__dirname, '../data/safety_alerts.json'), 'utf8'));

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length][b.length];
}

function similarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length >= 3 && b.length >= 3 && (a.startsWith(b) || b.startsWith(a))) return 0.92;
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length);
}

/**
 * Resolve a spoken medicine name — generic or Indian brand, possibly
 * misheard ("glycomate", "dolo six fifty") — to an entry in the formulary.
 */
export function findDrug(spoken) {
  const query = norm(spoken);
  const firstWord = norm(String(spoken || '').split(/\s+/)[0]);
  if (!query) return null;

  let best = null;
  for (const drug of drugs) {
    const names = [
      { label: drug.name, kind: 'generic' },
      { label: drug.generic, kind: 'generic' },
      ...drug.brands.map((b) => ({ label: b, kind: 'brand' })),
    ];
    for (const { label, kind } of names) {
      const n = norm(label);
      const score = Math.max(similarity(query, n), similarity(firstWord, norm(label.split(/\s+/)[0])) - 0.03);
      if (!best || score > best.score) best = { drug, matched: label, kind, score };
    }
  }
  return best && best.score >= 0.75 ? best : null;
}

/** Find a formulary medicine mentioned anywhere in free text (e.g. a transcript). */
export function findDrugInText(text) {
  const words = String(text || '').split(/[\s,.;:!?()"'।]+/).filter((w) => /[a-z]{4,}/i.test(w));
  let best = null;
  for (const word of words) {
    const hit = findDrug(word);
    if (hit && hit.score >= 0.9 && (!best || hit.score > best.score)) best = hit;
  }
  return best;
}

export function alertsFor(drugName) {
  const n = norm(drugName);
  if (!n) return [];
  return alerts.filter((a) => {
    const base = norm(a.drug.split('(')[0]);
    return base.includes(n) || n.includes(base);
  });
}
