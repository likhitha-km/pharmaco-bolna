import axios from 'axios';
import { getAnonymousId } from './anonymousId.js';

const BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4010/api';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 90000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor — attach auth token if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('pharmaco_token');
  const userId = localStorage.getItem('pharmaco_user_uid');
  const userEmail = localStorage.getItem('pharmaco_user_email');

  if (token) config.headers.Authorization = `Bearer ${token}`;
  // Always send a stable identifier so report ownership can be enforced —
  // the logged-in uid when signed in, otherwise a real per-browser
  // anonymous id (never the shared literal "anonymous").
  config.headers['X-User-Id'] = userId || getAnonymousId();
  if (userEmail) config.headers['X-User-Email'] = userEmail;

  return config;
});

// Response interceptor — handle errors globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.code === 'ECONNABORTED') {
      err.message = 'Request timed out. Please check your connection.';
    }
    return Promise.reject(err);
  }
);

// ---- Conversation API ----
export const conversationApi = {
  start: (data) => api.post('/conversation/start', data),
  message: (data) => api.post('/conversation/message', data),
  voice: (formData) => api.post('/conversation/voice', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  transcribe: (formData) => api.post('/conversation/transcribe', formData, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 45000 }),
  setLanguage: (conversationId, language) => api.put(`/conversation/${conversationId}/language`, { language }),
  end: (conversationId) => api.post('/conversation/end', { conversationId }),
  history: (conversationId) => api.get(`/conversation/history/${conversationId}`),
  updateFields: (conversationId, extractedData) => api.put(`/conversation/${conversationId}/fields`, { extractedData }),
  generateDraft: (conversationId) => api.post(`/conversation/${conversationId}/generate-draft`),
};

// ---- Report API ----
export const reportApi = {
  myReports: () => api.get('/report/my-reports'),
  saveDraft: (payload) => api.post('/report/draft', payload),
  submit: (id) => api.post(`/report/${id}/submit`),
  get: (id) => api.get(`/report/${id}`),
  getICSR: (id) => api.get(`/report/${id}/icsr`),
  followup: (id, message) => api.post(`/report/${id}/followup`, { message }),
  delete: (id) => api.delete(`/report/${id}`),
};

// ---- Drug API ----
export const drugApi = {
  search: (q) => api.get(`/drug/search?q=${encodeURIComponent(q)}`),
  profile: (name) => api.get(`/drug/profile/${encodeURIComponent(name)}`),
  safetyAlerts: () => api.get('/drug/safety-alerts'),
  signals: (name) => api.get(`/drug/signals/${encodeURIComponent(name)}`),
};

// ---- Dashboard API ----
export const dashboardApi = {
  publicStats: () => api.get('/dashboard/public-stats'),
  signalTracker: () => api.get('/dashboard/signal-tracker'),
  drugFrequency: () => api.get('/dashboard/drug-frequency'),
};

// ---- Voice API (Bolna + Sarvam) ----
export const voiceApi = {
  status: () => api.get('/voice/status'),
  calls: () => api.get('/voice/calls'),
  call: (id) => api.get(`/voice/calls/${encodeURIComponent(id)}`),
  scenarios: () => api.get('/voice/scenarios'),
  simulate: (scenarioId, speed = 1) => api.post('/voice/simulate', { scenarioId, speed }),
  placeCall: (payload) => api.post('/voice/call', payload),
  followupQueue: () => api.get('/voice/followup-queue'),
  tts: (text, language) => api.post('/voice/tts', { text, language }),
  eventsUrl: () => `${BASE_URL}/voice/events`,
  webSessionUrl: () => `${BASE_URL}/voice/web-session`,
};

export default api;
