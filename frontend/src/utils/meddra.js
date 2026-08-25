export const MEDDRA_CODES = {
  'Dizziness': '10013573', 'Nausea': '10028813', 'Vomiting': '10047700',
  'Headache': '10019211', 'Rash': '10037844', 'Fatigue': '10016256',
  'Chest pain': '10008479', 'Tremor': '10044565', 'Dyspnoea': '10013968',
  'Abdominal pain': '10000081', 'Myalgia': '10028411', 'Arthralgia': '10003239',
  'Anaphylaxis': '10002198', 'Angioedema': '10002424', 'Urticaria': '10046735',
};

export function getMedDRACode(term) {
  return MEDDRA_CODES[term] || null;
}

export function getConfidenceBadge(confidence) {
  if (confidence >= 0.9) return { label: 'High confidence', color: 'success' };
  if (confidence >= 0.7) return { label: 'Review suggested', color: 'warning' };
  return { label: 'Please verify', color: 'error' };
}
