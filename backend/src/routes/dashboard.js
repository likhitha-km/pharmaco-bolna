import express from 'express';
import { getPublicStats, getAggregateSignals } from '../services/firebaseService.js';
import { detectSignals } from '../services/signalDetectionService.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Seed demo stats for hackathon
const DEMO_STATS = {
  total_reports: 1247,
  reports_this_month: 89,
  drugs_with_signals: 23,
  languages_used: 9,
  reporter_type_distribution: { patient: 45, healthcare_professional: 32, caregiver: 15, anonymous: 8 },
  serious_vs_nonserious: { serious: 18, non_serious: 82 },
  common_adrs: [
    { term: 'Nausea', count: 234 }, { term: 'Dizziness', count: 198 }, { term: 'Rash', count: 176 },
    { term: 'Headache', count: 165 }, { term: 'Fatigue', count: 143 }, { term: 'Diarrhoea', count: 132 },
    { term: 'Myalgia', count: 98 }, { term: 'Insomnia', count: 87 }, { term: 'Tremor', count: 76 },
    { term: 'Palpitations', count: 65 },
  ],
  monthly_trend: [
    { month: 'Aug', reports: 67 }, { month: 'Sep', reports: 82 }, { month: 'Oct', reports: 74 },
    { month: 'Nov', reports: 91 }, { month: 'Dec', reports: 103 }, { month: 'Jan', reports: 88 },
    { month: 'Feb', reports: 95 }, { month: 'Mar', reports: 112 }, { month: 'Apr', reports: 98 },
    { month: 'May', reports: 124 }, { month: 'Jun', reports: 117 }, { month: 'Jul', reports: 89 },
  ],
  top_drugs: [
    { drug: 'Metformin', reports: 145 }, { drug: 'Atorvastatin', reports: 98 },
    { drug: 'Amoxicillin', reports: 87 }, { drug: 'Paracetamol', reports: 76 },
    { drug: 'Amlodipine', reports: 65 }, { drug: 'Ciprofloxacin', reports: 58 },
    { drug: 'Aspirin', reports: 52 }, { drug: 'Omeprazole', reports: 47 },
    { drug: 'Ibuprofen', reports: 43 }, { drug: 'Azithromycin', reports: 38 },
  ],
  geographic_distribution: [
    { state: 'Maharashtra', reports: 198 }, { state: 'Karnataka', reports: 176 },
    { state: 'Tamil Nadu', reports: 154 }, { state: 'Uttar Pradesh', reports: 132 },
    { state: 'Rajasthan', reports: 98 }, { state: 'Gujarat', reports: 87 },
    { state: 'West Bengal', reports: 76 }, { state: 'Delhi', reports: 132 },
    { state: 'Telangana', reports: 65 }, { state: 'Kerala', reports: 54 },
  ],
};

// GET /api/dashboard/public-stats
router.get('/public-stats', async (req, res) => {
  try {
    const dbStats = await getPublicStats();
    const merged = {
      ...DEMO_STATS,
      total_reports: DEMO_STATS.total_reports + (dbStats.total_reports || 0),
      reports_this_month: DEMO_STATS.reports_this_month + (dbStats.total_reports || 0),
      drugs_with_signals: DEMO_STATS.drugs_with_signals + (dbStats.drugs_with_signals || 0),
    };
    res.json(merged);
  } catch (error) {
    res.json(DEMO_STATS);
  }
});

// GET /api/dashboard/signal-tracker (regulator only)
router.get('/signal-tracker', requireAuth, async (req, res) => {
  try {
    const signals = await detectSignals(50);
    const demoSignals = [
      { drug: 'Metformin', adr: 'Nausea', count: 45, strength: 'Strong', recommended_action: 'Review label wording' },
      { drug: 'Atorvastatin', adr: 'Myalgia', count: 32, strength: 'Strong', recommended_action: 'Monitor CK levels guidance' },
      { drug: 'Ciprofloxacin', adr: 'Tendon rupture', count: 8, strength: 'Moderate', recommended_action: 'Enhanced prescriber education' },
      { drug: 'Amlodipine', adr: 'Oedema', count: 28, strength: 'Strong', recommended_action: 'Patient information update' },
      { drug: 'Azithromycin', adr: 'QT prolongation', count: 12, strength: 'Moderate', recommended_action: 'Cardiac monitoring guidance review' },
    ];
    res.json({ signals: [...demoSignals, ...signals], total: demoSignals.length + signals.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/dashboard/drug-frequency
router.get('/drug-frequency', async (req, res) => {
  try {
    const dbSignals = await getAggregateSignals(10);
    res.json({ drugs: DEMO_STATS.top_drugs, dbSignals });
  } catch (error) {
    res.json({ drugs: DEMO_STATS.top_drugs });
  }
});

export default router;
