import { findDrug } from '../voice/drugLookup.js';

/**
 * Resolve each suspected medicine against the formulary (shared with the
 * voice agent's lookup_medicine tool) so Indian brand names map to their
 * generic: "Glycomet" → Metformin, keeping what the user actually said.
 *
 * Adds, per medicine:
 *   spoken_name  — the name exactly as the user gave it
 *   name_source  — 'formulary_match' when Pharmaco resolved it, else 'user'
 */
export function annotateMedicines(extractedData) {
  if (!extractedData || !Array.isArray(extractedData.suspected_medicines)) return extractedData;
  extractedData.suspected_medicines = extractedData.suspected_medicines.map((med) => {
    if (!med?.name) return med;
    // The extraction model sometimes normalises "Glycomet" to "Metformin"
    // itself and keeps the brand in brand_name — that brand is what the
    // user actually said.
    const spoken = med.spoken_name || (med.brand_name && med.brand_name.toLowerCase() !== med.name.toLowerCase() ? med.brand_name : med.name);
    const match = findDrug(spoken);
    if (!match) return { ...med, spoken_name: spoken, name_source: med.name_source || 'user' };
    return {
      ...med,
      name: match.drug.name,
      brand_name: match.kind === 'brand' ? match.matched : med.brand_name || null,
      spoken_name: spoken,
      name_source: 'formulary_match',
      drug_class: match.drug.class,
    };
  });
  return extractedData;
}
