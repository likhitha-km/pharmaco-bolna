export const ICSR_REQUIRED_FIELDS = [
  'patient_identifier',
  'suspected_medicine_name',
  'adverse_reaction_description',
  'onset_date',
  'reporter_type',
];

export const ICSR_OPTIONAL_FIELDS = [
  'age_group',
  'gender',
  'dosage',
  'frequency',
  'route',
  'medical_history',
  'concomitant_medications',
  'dechallenge_information',
  'outcome',
  'causality_assessment',
  'hospitalization',
];

export const PVPI_REPORTING_THRESHOLDS = {
  serious: { timeframeDays: 15 },
  nonSerious: { timeframeDays: 90 },
};
