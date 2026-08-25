import express from 'express';
const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  // In production: verify Firebase ID token
  res.json({ success: true, message: 'Demo auth — use Firebase client SDK for production auth' });
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  res.json({ success: true, message: 'Demo auth — registration handled via Firebase client SDK' });
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  res.json({ user: req.user || { uid: 'anonymous', role: 'anonymous' } });
});

export default router;
