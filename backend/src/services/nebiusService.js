import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const NEBIUS_BASE_URL = process.env.NEBIUS_BASE_URL || 'https://api.studio.nebius.ai/v1';
const MODEL_FAST = process.env.NEBIUS_MODEL_FAST || 'Qwen/Qwen3-30B-A3B-Instruct-2507';
const MODEL_SMART = process.env.NEBIUS_MODEL_SMART || 'Qwen/Qwen3-235B-A22B-Instruct-2507';
const TIMEOUT_MS = Number(process.env.NEBIUS_TIMEOUT_MS) || 60000;

function getAuthHeaders() {
  const apiKey = process.env.NEBIUS_API_KEY;
  if (!apiKey || apiKey.startsWith('your_')) {
    throw new Error('Nebius API Key is missing or invalid. Please add a valid NEBIUS_API_KEY to backend/.env');
  }

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };
}

export { MODEL_FAST, MODEL_SMART };

/**
 * Standard Nebius chat completion call returning full response text.
 */
export async function callGroq(systemPrompt, messages, model, maxTokens = 1000, temperature = 0.1) {
  const payload = {
    model: model || MODEL_SMART,
    max_tokens: maxTokens,
    temperature,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
  };

  try {
    const response = await axios.post(`${NEBIUS_BASE_URL}/chat/completions`, payload, {
      headers: getAuthHeaders(),
      timeout: TIMEOUT_MS,
    });

    const content = response.data.choices?.[0]?.message?.content || '';
    return content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  } catch (error) {
    console.error('[NebiusService] callGroq error:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Streaming Nebius call — calls onChunk(text) for each delta.
 */
export async function streamGroq(systemPrompt, messages, onChunk) {
  const payload = {
    model: MODEL_SMART,
    max_tokens: 500,
    temperature: 0.4,
    stream: true,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
  };

  try {
    const response = await axios.post(`${NEBIUS_BASE_URL}/chat/completions`, payload, {
      headers: getAuthHeaders(),
      timeout: TIMEOUT_MS,
      responseType: 'stream',
    });

    let buffer = '';

    for await (const chunk of response.data) {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.replace(/^data: /, '').trim();
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content || '';
          if (delta) onChunk(delta);
        } catch (err) {
          // ignore malformed stream chunks
        }
      }
    }
  } catch (error) {
    console.error('[NebiusService] streamGroq error:', error.response?.data || error.message);
    throw error;
  }
}
