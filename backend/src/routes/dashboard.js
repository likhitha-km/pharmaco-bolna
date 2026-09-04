import express from 'express';
import { getRealPublicStats } from '../services/firebaseService.js';
import { detectSignals } from '../services/signalDetectionService.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// GET /api/dashboard/public-stats
// Real aggregate statistics computed from actually-submitted reports and
// drug signals. No hardcoded/demo numbers — a fresh database returns zeros.
router.get('/public-stats', async (req, res) => {
  try {
    const stats = await getRealPublicStats();
    res.json(stats);
  } catch (error) {
    console.error('[GET /public-stats]', error);
    res.status(500).json({ error: 'Failed to load statistics', message: error.message });
  }
});

// GET /api/dashboard/signal-tracker (regulator only)
// Real signals only — a drug/ADR pair must actually appear >= threshold
// times across submitted reports before it shows up here.
router.get('/signal-tracker', requireAuth, async (req, res) => {
  try {
    const signals = await detectSignals(50);
    res.json({ signals, total: signals.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/dashboard/drug-frequency
router.get('/drug-frequency', async (req, res) => {
  try {
    const stats = await getRealPublicStats();
    res.json({ drugs: stats.top_drugs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
