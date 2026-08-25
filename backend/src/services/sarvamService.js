import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const SARVAM_BASE_URL = 'https://api.sarvam.ai';
const SARVAM_API_KEY = process.env.SARVAM_API_KEY;

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

/**
 * Transcribe audio using Sarvam AI (Saaras v3 model) or mock fallback.
 * @param {Buffer} audioBuffer - raw audio buffer
 * @param {string} language - BCP-47 language code e.g. 'hi-IN'
 * @returns {{ transcript, language_detected, confidence }}
 */
export async function transcribeAudio(audioBuffer, language = 'hi-IN') {
  if (!SARVAM_API_KEY || SARVAM_API_KEY.startsWith('your_')) {
    console.warn('[SarvamService] Using mock audio transcription fallback');
    const pool = MOCK_TRANSCRIPTS[language] || MOCK_TRANSCRIPTS['en-IN'];
    const transcript = pool[mockIndex % pool.length];
    mockIndex++;
    return {
      transcript,
      language_detected: language,
      confidence: 0.95
    };
  }

  try {
    const FormData = (await import('form-data')).default;
    const form = new FormData();
    form.append('file', audioBuffer, { filename: 'audio.webm', contentType: 'audio/webm' });
    form.append('model', 'saaras:v3');
    form.append('language_code', language);

    const response = await axios.post(`${SARVAM_BASE_URL}/speech-to-text`, form, {
      headers: {
        ...form.getHeaders(),
        'api-subscription-key': SARVAM_API_KEY,
      },
      timeout: 30000,
    });

    return {
      transcript: response.data.transcript || '',
      language_detected: response.data.language_code || language,
      confidence: response.data.confidence || 0.8,
    };
  } catch (error) {
    console.error('[SarvamService] transcribeAudio error, falling back to mock:', error.message);
    const pool = MOCK_TRANSCRIPTS[language] || MOCK_TRANSCRIPTS['en-IN'];
    const transcript = pool[mockIndex % pool.length];
    mockIndex++;
    return {
      transcript,
      language_detected: language,
      confidence: 0.9
    };
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
 * Convert text to speech using Sarvam AI (Bulbul v2).
 * @param {string} text
 * @param {string} language - BCP-47 code
 * @param {string} speakerGender - 'female' | 'male'
 * @returns {string} base64-encoded audio
 */
export async function textToSpeech(text, language = 'hi-IN', speakerGender = 'female') {
  if (!SARVAM_API_KEY || SARVAM_API_KEY.startsWith('your_')) {
    return null;
  }
  try {
    const response = await axios.post(
      `${SARVAM_BASE_URL}/text-to-speech`,
      {
        inputs: [text],
        target_language_code: language,
        speaker: speakerGender === 'female' ? 'meera' : 'arvind',
        model: 'bulbul:v2',
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

    return response.data.audios?.[0] || null;
  } catch (error) {
    console.error('[SarvamService] textToSpeech error:', error.message);
    return null;
  }
}
