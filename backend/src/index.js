import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import conversationRoutes from './routes/conversation.js';
import reportRoutes from './routes/report.js';
import drugRoutes from './routes/drug.js';
import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import voiceRoutes from './routes/voice.js';
import { hydrateCalls } from './voice/voiceStore.js';
import { isBolnaConfigured, getAgentRegistry } from './services/bolnaService.js';
import { isSarvamConfigured } from './services/sarvamService.js';
import { requireAuth } from './middleware/auth.js';
import { rateLimit } from './middleware/rateLimit.js';

const app = express();
const PORT = process.env.PORT || 4010;
const HOST = process.env.HOST || '127.0.0.1';

// CORS
app.use(cors({
  origin: true,
  credentials: true,
}));

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Behind a hosting proxy (Render sets RENDER) the client IP comes from X-Forwarded-For;
// without this every visitor would share one rate-limit bucket.
if (process.env.RENDER || process.env.TRUST_PROXY) app.set('trust proxy', 1);

// Rate limiting. Routes that call paid APIs (LLM, speech) get tighter per-IP limits
// so a public URL cannot be used to run up the bill.
app.use('/api/', rateLimit(100, 60000));
const costly = rateLimit(Number(process.env.COSTLY_LIMIT_PER_MIN) || 30, 60000);
app.post(['/api/conversation/message', '/api/conversation/voice', '/api/conversation/transcribe', '/api/voice/tts'], costly);
app.post('/api/voice/simulate', rateLimit(6, 60000));

// Auth middleware (sets req.user on all routes)
app.use(requireAuth);

// Routes
app.use('/api/conversation', conversationRoutes);
app.use('/api/report', reportRoutes);
app.use('/api/drug', drugRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/voice', voiceRoutes);

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'Pharmaco API running',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: ['/api/conversation', '/api/report', '/api/drug', '/api/auth', '/api/dashboard', '/api/voice'],
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

app.listen(PORT, HOST, () => {
  console.log(`\n🌿 Pharmaco API running on http://${HOST}:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/`);
  console.log(`   Conversation: http://localhost:${PORT}/api/conversation`);
  console.log(`   Reports: http://localhost:${PORT}/api/report`);
  console.log(`   Dashboard: http://localhost:${PORT}/api/dashboard`);
  console.log(`   Voice: http://localhost:${PORT}/api/voice/status`);
  console.log(`   Bolna: ${isBolnaConfigured() ? `configured · ${Object.keys(getAgentRegistry()).length} agent(s)` : 'not configured — demo calls only'}`);
  console.log(`   Sarvam: ${isSarvamConfigured() ? 'configured' : 'not configured — scripted translations, no TTS'}\n`);
  hydrateCalls();
});
