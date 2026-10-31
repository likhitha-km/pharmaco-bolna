#!/usr/bin/env node
// Creates (or updates) the Pharmaco Voice agents on Bolna and records their
// ids in backend/bolna-agents.json.
//
//   npm run bolna:setup                 # languages from BOLNA_LANGUAGES (default hi,en,kn,ta)
//   npm run bolna:setup -- --dry-run    # print payloads + write tool JSON, no API calls
//   npm run bolna:setup -- --langs=hi,ta --modes=intake
//
// Needs BOLNA_API_KEY and PUBLIC_BASE_URL (your deployed backend, or an
// ngrok/cloudflared tunnel to localhost:4010) in backend/.env.

import 'dotenv/config';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { buildAgentPayload, dashboardTools, voiceConfig } from '../src/voice/agentBlueprint.js';
import { createAgent, updateAgent, isBolnaConfigured, AGENTS_FILE } from '../src/services/bolnaService.js';
import { VOICE_LANGUAGES } from '../src/voice/languages.js';

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v ?? true];
}));

const dryRun = Boolean(args['dry-run']);
const langs = String(args.langs || process.env.BOLNA_LANGUAGES || 'hi,en,kn,ta').split(',').map((l) => l.trim()).filter((l) => VOICE_LANGUAGES[l]);
const modes = String(args.modes || 'intake,followup').split(',').map((m) => m.trim());

const cfg = voiceConfig();
if (!cfg.publicBaseUrl) {
  console.warn('⚠️  PUBLIC_BASE_URL is not set — Bolna will not be able to reach the tools or the webhook.');
  console.warn('   Run e.g. `npx cloudflared tunnel --url http://localhost:4010` and put the https URL in backend/.env.\n');
}
if (!dryRun && !isBolnaConfigured()) {
  console.error('BOLNA_API_KEY is missing from backend/.env. Use --dry-run to preview the agent payloads.');
  process.exit(1);
}

const outDir = resolve(process.cwd(), 'bolna');
mkdirSync(resolve(outDir, 'tools'), { recursive: true });

const existing = existsSync(AGENTS_FILE) ? JSON.parse(readFileSync(AGENTS_FILE, 'utf8')).agents || {} : {};
const agents = { ...existing };

for (const mode of modes) {
  // Tool JSON in the dashboard's custom-function format, for pasting into the
  // agent's Tools tab if you prefer configuring tools by hand.
  writeFileSync(resolve(outDir, 'tools', `${mode}.json`), JSON.stringify(dashboardTools(mode, langs[0]), null, 2));

  for (const lang of langs) {
    const key = `${mode}:${lang}`;
    const payload = buildAgentPayload({ mode, lang });
    writeFileSync(resolve(outDir, `agent.${mode}.${lang}.json`), JSON.stringify(payload, null, 2));
    if (dryRun) {
      console.log(`• ${key}: payload written to bolna/agent.${mode}.${lang}.json`);
      continue;
    }

    // Progressive fallback: if Bolna rejects an optional block (STT keywords,
    // tools) we still get a working Sarvam voice agent and say what's missing.
    const variants = [
      { label: 'full', opts: {} },
      { label: 'without STT keywords', opts: { withKeywords: false } },
      { label: 'without tools — add bolna/tools/*.json in the dashboard', opts: { withKeywords: false, withTools: false } },
    ];
    let done = false;
    for (const { label, opts } of variants) {
      const body = buildAgentPayload({ mode, lang, ...opts });
      try {
        if (agents[key]) {
          await updateAgent(agents[key], body);
          console.log(`✓ ${key} updated (${label}) → ${agents[key]}`);
        } else {
          const res = await createAgent(body);
          agents[key] = res.agent_id;
          console.log(`✓ ${key} created (${label}) → ${res.agent_id}`);
        }
        done = true;
        break;
      } catch (err) {
        console.warn(`  ${key} (${label}) rejected: ${err.message}`);
      }
    }
    if (!done) console.error(`✗ ${key} could not be created — see errors above.`);
  }
}

if (!dryRun) {
  writeFileSync(AGENTS_FILE, JSON.stringify({ updatedAt: new Date().toISOString(), publicBaseUrl: cfg.publicBaseUrl, agents }, null, 2));
  console.log(`\nSaved ${Object.keys(agents).length} agent id(s) to ${AGENTS_FILE}`);
  console.log('Next: in the Bolna dashboard, connect your Sarvam key (Settings → Integrations → Sarvam),');
  console.log('and attach a phone number to the intake agent for inbound calls (set BOLNA_INBOUND_NUMBER in .env).');
}
