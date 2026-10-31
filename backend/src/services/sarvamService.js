import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const SARVAM_BASE_URL = 'https://api.sarvam.ai';
const SARVAM_API_KEY = process.env.SARVAM_API_KEY;
const SARVAM_STT_MODEL = process.env.SARVAM_REST_STT_MODEL || 'saaras:v3';
const SARVAM_TTS_MODEL = process.env.SARVAM_TTS_MODEL || 'bulbul:v3';
const SARVAM_TTS_SPEAKER = process.env.SARVAM_TTS_VOICE_ID || 'priya';

export function isSarvamConfigured() {
  return Boolean(SARVAM_API_KEY && !SARVAM_API_KEY.startsWith('your_'));
}

// Mock audio transcription pool for demo mode
const MOCK_TRANSCRIPTS = {
  'hi-IN': [
    'Metformin 500mg',
    'chakkar aaya aur haath kaanpne lage',
    'kal se शुरू हुआ',
    'haan doctor ne band kar di aur chakkar thoda kam hua',
    'diabetes ke liye le rahe the',
    '52 saal purush'
  ],
  'en-IN': [
    'Atorvastatin 40mg',
    'severe myalgia and weakness in both lower limbs',
    'started about 3 weeks ago',
    'yes drug was stopped and symptoms resolved',
    '62 year old male'
  ],
  'ta-IN': [
    'Amoxicillin 500mg',
    'skin rash with severe itching',
    'started on day 2',
    'yes it improved after stopping',
    '28 years female'
  ]
};

// Counter to cycle through mock speech inputs
let mockIndex = 0;

const AUDIO_EXTENSIONS = { 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav' };

/**
 * Transcribe with Sarvam speech-to-text. Throws on any failure — callers
 * decide whether a fallback is acceptable.
 * @param {Buffer} audioBuffer
 * @param {string} language - BCP-47 code, e.g. 'hi-IN'
 * @param {string} mimeType - e.g. 'audio/webm;codecs=opus'
 */
export async function transcribeWithSarvam(audioBuffer, language = 'hi-IN', mimeType = 'audio/webm') {
  if (!isSarvamConfigured()) {
    const err = new Error('Sarvam speech-to-text is not configured');
    err.code = 'stt_not_configured';
    throw err;
  }
  const baseType = String(mimeType || 'audio/webm').split(';')[0].trim().toLowerCase();
  const FormData = (await import('form-data')).default;
  const form = new FormData();
  form.append('file', audioBuffer, { filename: `audio.${AUDIO_EXTENSIONS[baseType] || 'webm'}`, contentType: baseType });
  form.append('model', SARVAM_STT_MODEL);
  form.append('language_code', language);

  const response = await axios.post(`${SARVAM_BASE_URL}/speech-to-text`, form, {
    headers: { ...form.getHeaders(), 'api-subscription-key': SARVAM_API_KEY },
    timeout: 30000,
  });
  return {
    transcript: response.data.transcript || '',
    language_detected: response.data.language_code || language,
    confidence: response.data.confidence ?? null,
    model: SARVAM_STT_MODEL,
  };
}

/**
 * Legacy transcription used by POST /api/conversation/voice: Sarvam, or a
 * canned mock transcript when Sarvam is unavailable. The chat composer no
 * longer uses this path (see POST /api/conversation/transcribe) because a
 * mock transcript must never be presented as what the user said.
 * @param {Buffer} audioBuffer - raw audio buffer
 * @param {string} language - BCP-47 language code e.g. 'hi-IN'
 * @returns {{ transcript, language_detected, confidence }}
 */
export async function transcribeAudio(audioBuffer, language = 'hi-IN') {
  const mock = () => {
    const pool = MOCK_TRANSCRIPTS[language] || MOCK_TRANSCRIPTS['en-IN'];
    const transcript = pool[mockIndex % pool.length];
    mockIndex++;
    return { transcript, language_detected: language, confidence: 0.9 };
  };
  if (!isSarvamConfigured()) {
    console.warn('[SarvamService] Using mock audio transcription fallback');
    return mock();
  }
  try {
    return await transcribeWithSarvam(audioBuffer, language);
  } catch (error) {
    console.error('[SarvamService] transcribeAudio error, falling back to mock:', error.message);
    return mock();
  }
}

/**
 * Translate text using Sarvam AI (Mayura v1).
 * @param {string} text
 * @param {string} sourceLanguage - BCP-47 code
 * @param {string} targetLanguage - default 'en-IN'
 * @returns {string} translated text
 */
export async function translateText(text, sourceLanguage, targetLanguage = 'en-IN') {
  if (!SARVAM_API_KEY || SARVAM_API_KEY.startsWith('your_')) {
    return text;
  }
  try {
    const response = await axios.post(
      `${SARVAM_BASE_URL}/translate`,
      {
        input: text,
        source_language_code: sourceLanguage,
        target_language_code: targetLanguage,
        model: 'mayura:v1',
        enable_preprocessing: true,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'api-subscription-key': SARVAM_API_KEY,
        },
        timeout: 15000,
      }
    );

    return response.data.translated_text || text;
  } catch (error) {
    console.error('[SarvamService] translateText error:', error.message);
    // Return original text as fallback
    return text;
  }
}

/**
 * Convert text to speech using Sarvam AI Bulbul — the same voice ("Priya")
 * the Bolna phone agent speaks with, so web and phone sound identical.
 * Falls back to the Bulbul v2 request shape if v3 is rejected.
 * @param {string} text
 * @param {string} language - BCP-47 code
 * @returns {string|null} base64-encoded WAV audio
 */
export async function textToSpeech(text, language = 'hi-IN') {
  if (!isSarvamConfigured() || !text) return null;
  const headers = { 'Content-Type': 'application/json', 'api-subscription-key': SARVAM_API_KEY };
  const attempts = [
    { text: text.slice(0, 2500), target_language_code: language, speaker: SARVAM_TTS_SPEAKER, model: SARVAM_TTS_MODEL },
    { inputs: [text.slice(0, 1500)], target_language_code: language, speaker: 'anushka', model: 'bulbul:v2', enable_preprocessing: true },
  ];
  for (const body of attempts) {
    try {
      const response = await axios.post(`${SARVAM_BASE_URL}/text-to-speech`, body, { headers, timeout: 20000 });
      const audio = response.data.audios?.[0];
      if (audio) return audio;
    } catch (error) {
      console.error(`[SarvamService] textToSpeech (${body.model}) error:`, error.response?.data || error.message);
    }
  }
  return null;
}
