import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Every external service is switched off so the suite is offline, fast and
// deterministic, and can never write to the real Firestore project:
// Firebase → in-memory store, Nebius/Sarvam/Bolna → "not configured" paths.
export const TEST_ENV = {
  FIREBASE_SERVICE_ACCOUNT_PATH: '/nonexistent/serviceAccount.json',
  NEBIUS_API_KEY: '',
  SARVAM_API_KEY: '',
  BOLNA_API_KEY: '',
  PUBLIC_BASE_URL: 'https://example.test',
  VOICE_TOOL_SECRET: 'test-secret',
  HOST: '127.0.0.1',
};

export function applyTestEnv() {
  Object.assign(process.env, TEST_ENV);
}

const backendDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Start the real API server on a free-ish port with the test environment. */
export async function startServer(port) {
  const proc = spawn(process.execPath, ['src/index.js'], {
    cwd: backendDir,
    env: { ...process.env, ...TEST_ENV, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  proc.stdout.on('data', (d) => { log += d; });
  proc.stderr.on('data', (d) => { log += d; });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 80; i++) {
    try {
      const res = await fetch(`${base}/`);
      if (res.ok) return { base, stop: () => proc.kill(), log: () => log };
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  proc.kill();
  throw new Error(`server did not start:\n${log}`);
}

export async function api(base, path, { method = 'GET', body, headers = {} } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, json, text };
}

/** Poll until `check()` returns truthy, or fail after `timeoutMs`. */
export async function waitFor(check, { timeoutMs = 60000, intervalMs = 250, label = 'condition' } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const value = await check();
    if (value) return value;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`timed out waiting for ${label}`);
}
