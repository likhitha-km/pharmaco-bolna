import { getAggregateSignals } from './firebaseService.js';

/**
 * Minimum Information Needed (MIN) threshold for a signal.
 * A drug-ADR pair is flagged as a signal if >= THRESHOLD reports.
 */
const SIGNAL_THRESHOLD = 3;

/**
 * Detect signals from aggregated drug ADR data.
 * Returns list of drug-ADR pairs exceeding signal threshold.
 */
export async function detectSignals(limit = 50) {
  const aggregated = await getAggregateSignals(limit);
  const signals = [];

  for (const drugData of aggregated) {
    if (!drugData.adrCounts) continue;
    for (const [adr, count] of Object.entries(drugData.adrCounts)) {
      if (count >= SIGNAL_THRESHOLD) {
        signals.push({
          drug: drugData.drugName,
          adr,
          count,
          strength: count >= 10 ? 'Strong' : count >= 5 ? 'Moderate' : 'Weak',
          recommended_action:
            count >= 10
              ? 'Expedited review recommended'
              : count >= 5
              ? 'Monitor and aggregate more data'
              : 'Continue passive monitoring',
          detected_at: new Date().toISOString(),
        });
      }
    }
  }

  return signals.sort((a, b) => b.count - a.count);
}

/**
 * Calculate disproportionality score (simplified PRR proxy).
 * @param {number} drugAdrCount - cases of drug+ADR
 * @param {number} totalDrugCases - all cases for drug
 * @param {number} totalAdrCases - all cases for ADR across all drugs
 * @param {number} totalCases - all cases total
 */
export function calculatePRR(drugAdrCount, totalDrugCases, totalAdrCases, totalCases) {
  if (!totalDrugCases || !totalAdrCases || !totalCases) return null;
  const a = drugAdrCount;
  const b = totalDrugCases - drugAdrCount;
  const c = totalAdrCases - drugAdrCount;
  const d = totalCases - a - b - c;
  if (b === 0 || c === 0) return null;
  const prr = (a / (a + b)) / (c / (c + d));
  return Math.round(prr * 100) / 100;
}
