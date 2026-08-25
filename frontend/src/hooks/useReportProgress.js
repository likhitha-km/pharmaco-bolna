import { useMemo } from 'react';

const REQUIRED_FIELDS = [
  { key: 'drug_name', label: 'Drug Name', required: true },
  { key: 'adverse_reaction', label: 'Reaction', required: true },
  { key: 'onset_date', label: 'When it started', required: true },
];
const OPTIONAL_FIELDS = [
  { key: 'dosage', label: 'Dosage', required: false },
  { key: 'frequency', label: 'How often', required: false },
  { key: 'reason', label: 'Reason for taking', required: false },
  { key: 'medical_history', label: 'Medical history', required: false },
  { key: 'dechallenge', label: 'Did it improve after stopping?', required: false },
  { key: 'outcome', label: 'Outcome', required: false },
  { key: 'reporter_type', label: 'Reporter type', required: false },
];

export function useReportProgress(extractedData) {
  return useMemo(() => {
    if (!extractedData) {
      return {
        fields: [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS].map((f) => ({ ...f, filled: false })),
        completedCount: 0,
        totalCount: REQUIRED_FIELDS.length + OPTIONAL_FIELDS.length,
        percentage: 0,
      };
    }

    const med = extractedData.suspected_medicines?.[0];
    const reaction = extractedData.adverse_reactions?.[0];
    const clinical = extractedData.clinical_context || {};

    const checks = {
      drug_name: !!med?.name,
      adverse_reaction: !!reaction?.original_text,
      onset_date: !!reaction?.onset_date,
      dosage: !!med?.dosage,
      frequency: !!med?.frequency,
      reason: !!clinical.reason_for_taking,
      medical_history: !!clinical.medical_history,
      dechallenge: extractedData.causality_signals?.dechallenge !== 'unknown',
      outcome: !!clinical.outcome,
      reporter_type: !!extractedData.metadata?.reporter_type,
    };

    const allFields = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS].map((f) => ({
      ...f,
      filled: !!checks[f.key],
    }));

    const completedCount = allFields.filter((f) => f.filled).length;
    const totalCount = allFields.length;
    const percentage = Math.round((completedCount / totalCount) * 100);

    return { fields: allFields, completedCount, totalCount, percentage };
  }, [extractedData]);
}
