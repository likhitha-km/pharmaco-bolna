import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { VOICE_LANGUAGES, WELCOME, FOLLOWUP_WELCOME, toVoiceLang } from './languages.js';

// Builds the Bolna agent definitions for Pharmaco Voice. One agent per
// (mode, language): Bolna's transcriber is configured for a single language,
// and Sarvam Saaras is markedly more accurate when told which one to expect.
//
//   intake   — inbound / "call me" calls: collect a brand-new ADR report
//   followup — outbound calls that fill in fields missing from an existing
//              report (the PvPI follow-up problem)

const __dirname = dirname(fileURLToPath(import.meta.url));
const drugs = JSON.parse(readFileSync(resolve(__dirname, '../data/drugs.json'), 'utf8'));

// Indian brand names are exactly what generic STT mishears ("Dolo", "Glycomet",
// "Pan 40"). Saaras v4 accepts up to 50 keywords to bias recognition.
export const SARVAM_KEYWORDS = [...new Set(drugs.flatMap((d) => [d.name, d.brands[0], d.brands[1]]).filter(Boolean))]
  .filter((k) => k.length <= 64)
  .slice(0, 50);

export function voiceConfig() {
  const base = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
  return {
    publicBaseUrl: base,
    toolSecret: process.env.VOICE_TOOL_SECRET || 'pharmaco-dev-secret',
    llmProvider: process.env.BOLNA_LLM_PROVIDER || 'openai',
    llmModel: process.env.BOLNA_LLM_MODEL || 'gpt-5.4-mini',
    llmTemperature: Number(process.env.BOLNA_LLM_TEMPERATURE ?? 1),
    telephony: process.env.BOLNA_TELEPHONY_PROVIDER || 'plivo',
    ttsModel: process.env.SARVAM_TTS_MODEL || 'bulbul:v3',
    ttsVoiceId: process.env.SARVAM_TTS_VOICE_ID || 'priya',
    ttsVoiceName: process.env.SARVAM_TTS_VOICE_NAME || 'Priya',
    sttModel: process.env.SARVAM_STT_MODEL || 'saaras:v4',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompts
// ─────────────────────────────────────────────────────────────────────────────

const SHARED_RULES = (langName) => `
LANGUAGE & STYLE
- Speak ${langName}, in simple everyday words a village elder would understand. Mixing English medicine names and common English words (like "tablet", "BP", "sugar") is natural and fine.
- If the caller switches language, follow them.
- This is a PHONE CALL. Keep every reply to one or two short sentences. Ask ONE question at a time. Never use lists, markdown, or symbols.
- Be warm and patient. Acknowledge what they said before asking the next thing ("Achha, samajh gayi.").
- Say numbers the way people speak them. When reading a reference number, say it slowly, character by character.

SAFETY — NON-NEGOTIABLE
- The moment the caller mentions anything like trouble breathing, swelling of the face, lips or throat, fainting or unconsciousness, chest pain, a seizure or fits, heavy bleeding, blood in vomit or stool, or skin peeling or blistering over large areas, call check_emergency right away with their words.
- If check_emergency says it is an emergency: calmly tell them to call 108 for an ambulance (or 112, the national emergency number) or go to the nearest hospital NOW, repeat it once, and then end the conversation. Do not continue the interview.
- Never diagnose. Never tell them to stop, start, or change any medicine — say "please talk to your doctor about that".
- Never promise compensation or that the drug will be banned. You are collecting a safety report for India's Pharmacovigilance Programme (PvPI).
- Do not ask for full name, address, or ID numbers. Initials are enough.`;

export function intakePrompt(lang) {
  const { name } = VOICE_LANGUAGES[lang];
  return `You are Priya, Pharmaco's voice assistant. People call you to report a side effect (adverse drug reaction) they or a family member had after taking a medicine. Your job is to have a short, kind conversation and collect what a pharmacovigilance officer needs, then file the report.
${SHARED_RULES(name)}

WHAT TO COLLECT (naturally, in roughly this order — skip anything they already told you)
1. Which medicine. As soon as you hear a medicine or brand name, call lookup_medicine to confirm the generic name. If it is a known side effect, you may reassure them ("yes, this is a known effect — reporting it really helps").
2. Dose and how often they take it, and why they were taking it.
3. What happened, in their own words. How bad was it?
4. When it started — after how many days of taking the medicine.
5. Did they stop or reduce the medicine, and did it get better after that? Did it come back if they restarted?
6. Any other medicines they take regularly.
7. How they are now — recovered, getting better, still the same, or admitted to hospital.
8. Patient's age and whether male or female. Who is calling — the patient, a family member, or a doctor/pharmacist.

FINISHING
- When you have at least the medicine, the reaction and roughly when it started, briefly read back the key details in one or two sentences and ask "Is that correct?".
- After they confirm, call file_adr_report with everything you collected. Write reaction_description in English; put their exact words in reaction_original.
- Read the reference number from the result slowly, thank them for helping make medicines safer for everyone, and say goodbye.
- If they cannot remember something, that is fine — never pressure them. File with what you have.

Today's date is {current_date}.`;
}

export function followupPrompt(lang) {
  const { name } = VOICE_LANGUAGES[lang];
  return `You are Priya from Pharmaco, calling back someone who already reported a side effect. The report is incomplete, and a few missing details decide whether experts can assess it. Be brief, respectful of their time, and stop if they are busy.
${SHARED_RULES(name)}

THE EXISTING REPORT
- Reference: {report_ref}
- Medicine: {medicine_name}
- Reaction they reported: {reaction_summary}
- Details still missing: {missing_fields}

HOW TO RUN THE CALL
- Confirm you are speaking to the right person and that it is a good time. If not, apologise, say you will try later, and end.
- Remind them in one sentence what they reported.
- Ask ONLY about the missing details, one at a time, in plain words (for example "dechallenge" means: "Did the problem get better after the medicine was stopped?").
- Also ask how they are feeling now.
- When done, call update_adr_report with report_id "{report_id}" and whatever new details you learned. Then thank them and say goodbye.

Today's date is {current_date}.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tools (custom function calls that hit the Pharmaco backend mid-call)
// ─────────────────────────────────────────────────────────────────────────────

const str = (description) => ({ type: 'string', description });

const REPORT_FIELDS = {
  medicine_name: str('Medicine name as the caller said it, e.g. "Dolo 650" or "Metformin"'),
  dosage: str('Strength or dose, e.g. "500 mg". Empty if unknown'),
  frequency: str('How often, e.g. "twice a day". Empty if unknown'),
  reason_for_taking: str('Why they take the medicine, in English, e.g. "type 2 diabetes"'),
  reaction_description: str('The side effect described in plain English, e.g. "dizziness and shaking hands"'),
  reaction_original: str("The caller's own words for the side effect, in their language"),
  severity: str('mild, moderate, or severe'),
  onset: str('When it started, e.g. "3 days after starting" or a date'),
  dechallenge: str('positive if it improved after stopping/reducing the medicine, negative if it did not, unknown otherwise'),
  rechallenge: str('positive if it came back after restarting, negative if it did not, not_applicable if never restarted'),
  other_medicines: str('Other regular medicines, comma separated. Empty if none'),
  medical_history: str('Relevant illnesses, e.g. "diabetes, high BP"'),
  outcome: str('Current status in English: recovered, recovering, not recovered, or hospitalised'),
  hospitalised: str('yes or no'),
  patient_age: str('Age in years, e.g. "52"'),
  patient_gender: str('male, female, or other'),
  patient_initials: str('Initials only if offered, e.g. "R.K."'),
  reporter_type: str('patient, caregiver, or healthcare_professional'),
};

function toolDefs(mode) {
  const common = [
    {
      name: 'check_emergency',
      description: 'Call IMMEDIATELY when the caller mentions anything that could be life-threatening: trouble breathing, swelling of face/lips/throat, fainting, chest pain, seizure/fits, heavy bleeding, blood in vomit or stool, or widespread skin peeling/blisters. Returns whether to send them to emergency care right now.',
      pre_call_message: '',
      parameters: {
        type: 'object',
        properties: { symptoms: str("The caller's description of the symptoms, in their words") },
        required: ['symptoms'],
      },
      method: 'POST',
      path: '/api/voice/tools/check-emergency',
    },
    {
      name: 'lookup_medicine',
      description: 'Call when the caller names a medicine (generic or Indian brand name such as Dolo, Glycomet, Pan 40, Telma). Returns the generic name, drug class, known side effects, and any CDSCO safety alerts.',
      pre_call_message: '',
      parameters: {
        type: 'object',
        properties: { medicine_name: str('Medicine or brand name as heard') },
        required: ['medicine_name'],
      },
      method: 'GET',
      path: '/api/voice/tools/lookup-medicine',
    },
  ];

  if (mode === 'followup') {
    return [
      ...common,
      {
        name: 'update_adr_report',
        description: 'Call once at the end of the follow-up call to add the newly collected details to the existing report.',
        pre_call_message: '',
        parameters: {
          type: 'object',
          properties: { report_id: str('The report_id given in your instructions'), ...REPORT_FIELDS },
          required: ['report_id'],
        },
        method: 'POST',
        path: '/api/voice/tools/update-report',
      },
    ];
  }

  return [
    ...common,
    {
      name: 'file_adr_report',
      description: 'Call once, after the caller has confirmed the read-back, to file the side-effect report with Pharmaco. Returns a reference number to read out to the caller.',
      pre_call_message: '',
      parameters: {
        type: 'object',
        properties: REPORT_FIELDS,
        required: ['medicine_name', 'reaction_description'],
      },
      method: 'POST',
      path: '/api/voice/tools/file-report',
    },
  ];
}

/** %(name)s template so Bolna substitutes each LLM-chosen argument. */
function paramTemplate(def, lang, mode) {
  const param = {};
  for (const key of Object.keys(def.parameters.properties)) param[key] = `%(${key})s`;
  // Correlation context so the backend can attach the tool hit to the live call.
  param.execution_id = '{execution_id}';
  param.agent_id = '{agent_id}';
  param.call_language = lang;
  param.call_mode = mode;
  return param;
}

/**
 * Tools in the shape documented for Bolna's dashboard / custom-function schema
 * ("key": "custom_task"). Exported so the setup script can write them to disk
 * for pasting into the Tools tab if the API shape ever changes.
 */
export function dashboardTools(mode, lang) {
  const { publicBaseUrl, toolSecret } = voiceConfig();
  return toolDefs(mode).map((def) => ({
    name: def.name,
    description: def.description,
    pre_call_message: def.pre_call_message,
    parameters: def.parameters,
    key: 'custom_task',
    value: {
      method: def.method,
      param: paramTemplate(def, lang, mode),
      url: `${publicBaseUrl}${def.path}`,
      api_token: `Bearer ${toolSecret}`,
      headers: def.method === 'GET' ? {} : { 'Content-Type': 'application/json' },
    },
  }));
}

/** api_tools block for POST /v2/agent: OpenAI-style definitions + per-tool HTTP params. */
function apiTools(mode, lang) {
  const tools = dashboardTools(mode, lang);
  return {
    tools: tools.map(({ name, description, parameters, pre_call_message, key }) => ({ name, description, parameters, pre_call_message, key })),
    tools_params: Object.fromEntries(
      tools.map((t) => [t.name, { method: t.value.method, url: t.value.url, api_token: t.value.api_token, param: JSON.stringify(t.value.param) }])
    ),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Full agent payload for POST https://api.bolna.ai/v2/agent
// ─────────────────────────────────────────────────────────────────────────────

export function buildAgentPayload({ mode = 'intake', lang = 'hi', withKeywords = true, withTools = true } = {}) {
  const code = toVoiceLang(lang);
  const cfg = voiceConfig();
  const welcome = mode === 'followup' ? FOLLOWUP_WELCOME[code] || FOLLOWUP_WELCOME.en : WELCOME[code];

  const transcriber = {
    provider: 'sarvam',
    model: cfg.sttModel,
    language: code,
    stream: true,
    endpointing: 500,
  };
  if (withKeywords) transcriber.keywords = SARVAM_KEYWORDS.join(',');

  const toolsConfig = {
    llm_agent: {
      agent_type: 'simple_llm_agent',
      agent_flow_type: 'streaming',
      llm_config: {
        provider: cfg.llmProvider,
        model: cfg.llmModel,
        max_tokens: 400,
        temperature: cfg.llmTemperature,
      },
    },
    synthesizer: {
      provider: 'sarvam',
      provider_config: {
        voice: cfg.ttsVoiceName,
        voice_id: cfg.ttsVoiceId,
        model: cfg.ttsModel,
        language: code,
        speed: 1.0,
      },
      stream: true,
      buffer_size: 150,
      audio_format: 'wav',
    },
    transcriber,
    input: { provider: cfg.telephony, format: 'wav' },
    output: { provider: cfg.telephony, format: 'wav' },
  };
  if (withTools) toolsConfig.api_tools = apiTools(mode, code);

  return {
    agent_config: {
      agent_name: `Pharmaco Voice · ${mode} · ${VOICE_LANGUAGES[code].name}`,
      agent_welcome_message: welcome,
      webhook_url: `${cfg.publicBaseUrl}/api/voice/webhook?key=${encodeURIComponent(cfg.toolSecret)}`,
      call_summary_enabled: true,
      tasks: [
        {
          task_type: 'conversation',
          toolchain: { execution: 'sequential', pipelines: [['transcriber', 'llm', 'synthesizer']] },
          tools_config: toolsConfig,
          task_config: {
            call_terminate: mode === 'followup' ? 240 : 480,
            hangup_after_silence: 15,
          },
        },
      ],
    },
    agent_prompts: {
      task_1: { system_prompt: mode === 'followup' ? followupPrompt(code) : intakePrompt(code) },
    },
  };
}
