import axios from 'axios';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import dotenv from 'dotenv';
dotenv.config();

const BOLNA_BASE_URL = 'https://api.bolna.ai';
export const AGENTS_FILE = resolve(process.cwd(), 'bolna-agents.json');

export function isBolnaConfigured() {
  const key = process.env.BOLNA_API_KEY;
  return Boolean(key && !key.startsWith('your_'));
}

function client() {
  if (!isBolnaConfigured()) {
    throw new Error('BOLNA_API_KEY is not set — add it to backend/.env (Bolna dashboard → Developers → API Keys)');
  }
  return axios.create({
    baseURL: BOLNA_BASE_URL,
    timeout: 30000,
    headers: { Authorization: `Bearer ${process.env.BOLNA_API_KEY}`, 'Content-Type': 'application/json' },
  });
}

function describeError(error) {
  const detail = error.response?.data ? JSON.stringify(error.response.data) : error.message;
  return `${error.response?.status || ''} ${detail}`.trim();
}

/**
 * Agent ids, keyed "<mode>:<lang>" (e.g. "intake:hi"). Written by
 * `npm run bolna:setup`; individual env vars (BOLNA_AGENT_INTAKE_HI) override.
 */
export function getAgentRegistry() {
  let registry = {};
  if (existsSync(AGENTS_FILE)) {
    try {
      registry = JSON.parse(readFileSync(AGENTS_FILE, 'utf8')).agents || {};
    } catch (err) {
      console.warn('[Bolna] could not read bolna-agents.json:', err.message);
    }
  }
  for (const [key, value] of Object.entries(process.env)) {
    const m = key.match(/^BOLNA_AGENT_(INTAKE|FOLLOWUP)_([A-Z]{2})$/);
    if (m && value) registry[`${m[1].toLowerCase()}:${m[2].toLowerCase()}`] = value;
  }
  return registry;
}

/** Falls back to the Hindi, then English, agent of the same mode. */
export function resolveAgentId(mode, lang) {
  const registry = getAgentRegistry();
  return registry[`${mode}:${lang}`] || registry[`${mode}:hi`] || registry[`${mode}:en`] || null;
}

export async function createAgent(payload) {
  try {
    const { data } = await client().post('/v2/agent', payload);
    return data;
  } catch (error) {
    throw new Error(`Bolna create agent failed: ${describeError(error)}`);
  }
}

export async function updateAgent(agentId, payload) {
  try {
    const { data } = await client().put(`/v2/agent/${agentId}`, payload);
    return data;
  } catch (error) {
    throw new Error(`Bolna update agent failed: ${describeError(error)}`);
  }
}

export async function getAgent(agentId) {
  try {
    const { data } = await client().get(`/v2/agent/${agentId}`);
    return data;
  } catch (error) {
    throw new Error(`Bolna get agent failed: ${describeError(error)}`);
  }
}

/**
 * Place an outbound call. `userData` keys become {variables} in the prompt.
 * @returns {{ execution_id, status }}
 */
export async function placeCall({ agentId, phone, userData = {} }) {
  const body = { agent_id: agentId, recipient_phone_number: phone, user_data: userData };
  if (process.env.BOLNA_FROM_NUMBER) body.from_phone_number = process.env.BOLNA_FROM_NUMBER;
  try {
    const { data } = await client().post('/call', body);
    return data;
  } catch (error) {
    throw new Error(`Bolna call failed: ${describeError(error)}`);
  }
}

export async function getExecution(executionId) {
  try {
    const { data } = await client().get(`/executions/${executionId}`);
    return data;
  } catch (error) {
    throw new Error(`Bolna get execution failed: ${describeError(error)}`);
  }
}

/** Short-lived, single-use credentials for the browser web-call SDK. */
export async function createWebCallSession({ agentId, userData = {} }) {
  try {
    const { data } = await client().post('/web-call/session', { agent_id: agentId, user_data: userData });
    return data;
  } catch (error) {
    throw new Error(`Bolna web-call session failed: ${describeError(error)}`);
  }
}
