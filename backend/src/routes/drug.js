import express from 'express';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getDrugSignals, getAggregateSignals } from '../services/firebaseService.js';

const router = express.Router();
const __dirname = dirname(fileURLToPath(import.meta.url));

// Load drug database
let drugsDB = [];
let safetyAlertsDB = [];

try {
  drugsDB = JSON.parse(readFileSync(resolve(__dirname, '../data/drugs.json'), 'utf8'));
  safetyAlertsDB = JSON.parse(readFileSync(resolve(__dirname, '../data/safety_alerts.json'), 'utf8'));
} catch (e) {
  console.warn('[DrugRoute] Could not load drug data:', e.message);
}

// GET /api/drug/search?q=query
router.get('/search', (req, res) => {
  try {
    const query = (req.query.q || '').toLowerCase().trim();
    if (!query) return res.json({ drugs: drugsDB.slice(0, 10) });

    const results = drugsDB
      .filter(
        (d) =>
          d.name.toLowerCase().includes(query) ||
          d.generic.toLowerCase().includes(query) ||
          d.brands.some((b) => b.toLowerCase().includes(query)) ||
          d.class.toLowerCase().includes(query)
      )
      .slice(0, 10);

    res.json({ drugs: results, total: results.length, query });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/drug/safety-alerts
router.get('/safety-alerts', (req, res) => {
  try {
    res.json({ alerts: safetyAlertsDB, total: safetyAlertsDB.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/drug/signals/:drugName
router.get('/signals/:drugName', async (req, res) => {
  try {
    const signals = await getDrugSignals(req.params.drugName);
    res.json({ signals, drugName: req.params.drugName });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/drug/profile/:drugName
router.get('/profile/:drugName', async (req, res) => {
  try {
    const { drugName } = req.params;
    const drug = drugsDB.find(
      (d) => d.name.toLowerCase() === drugName.toLowerCase() || d.generic.toLowerCase() === drugName.toLowerCase()
    );

    if (!drug) return res.status(404).json({ error: 'Drug not found' });

    // Get signals from database
    const signals = await getDrugSignals(drugName);

    // Build ADR trend data (mock for demo)
    const trendData = Array.from({ length: 12 }, (_, i) => ({
      month: new Date(2025, i, 1).toLocaleString('default', { month: 'short' }),
      reports: Math.floor(Math.random() * 20) + 5,
    }));

    res.json({
      drug,
      signals,
      trendData,
      safetyAlerts: safetyAlertsDB.filter((a) => a.drug.toLowerCase().includes(drugName.toLowerCase())),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
