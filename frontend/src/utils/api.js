import axios from 'axios';

const BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000/api';

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
  if (userId) config.headers['X-User-Id'] = userId;
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
  end: (conversationId) => api.post('/conversation/end', { conversationId }),
  history: (conversationId) => api.get(`/conversation/history/${conversationId}`),
};

// ---- Report API ----
export const reportApi = {
  myReports: () => api.get('/report/my-reports'),
  saveDraft: (payload) => api.post('/report/draft', payload),
  submit: (id) => api.post(`/report/${id}/submit`),
  get: (id) => api.get(`/report/${id}`),
  getICSR: (id) => api.get(`/report/${id}/icsr`),
  followup: (id, message) => api.post(`/report/${id}/followup`, { message }),
  export: (id) => api.post(`/report/${id}/export`),
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

export default api;
