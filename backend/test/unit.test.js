import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyTestEnv } from './helpers.js';

applyTestEnv();
const { findDrug, findDrugInText } = await import('../src/voice/drugLookup.js');
const { annotateMedicines } = await import('../src/utils/medicineMatch.js');
const { parseTranscript, toolArgsToExtracted, spokenRef } = await import('../src/voice/callPipeline.js');
const { buildAgentPayload } = await import('../src/voice/agentBlueprint.js');

test('brand names resolve to generics, tolerating mishearing', () => {
  assert.equal(findDrug('Glycomet').drug.name, 'Metformin');
  assert.equal(findDrug('Glycomet').kind, 'brand');
  assert.equal(findDrug('glycomate').drug.name, 'Metformin');
  assert.equal(findDrug('Dolo 650').drug.name, 'Paracetamol');
  assert.equal(findDrug('Mox').drug.name, 'Amoxicillin');
  assert.equal(findDrug('qwertyzzz'), null);
  assert.equal(findDrugInText('मैंने Voveran का injection लगवाया').drug.name, 'Diclofenac');
});

test('chat medicines are annotated without losing what the user said', () => {
  const data = annotateMedicines({ suspected_medicines: [{ name: 'Glycomet', dosage: '500 mg' }, { name: 'SomeLocalTonic' }] });
  const [glycomet, unknown] = data.suspected_medicines;
  assert.equal(glycomet.name, 'Metformin');
  assert.equal(glycomet.spoken_name, 'Glycomet');
  assert.equal(glycomet.brand_name, 'Glycomet');
  assert.equal(glycomet.name_source, 'formulary_match');
  assert.equal(glycomet.dosage, '500 mg');
  assert.equal(unknown.name, 'SomeLocalTonic');
  assert.equal(unknown.name_source, 'user');
  // The LLM may already have normalised the name and kept the brand separately.
  const preNormalised = annotateMedicines({ suspected_medicines: [{ name: 'Metformin', brand_name: 'Glycomet' }] }).suspected_medicines[0];
  assert.equal(preNormalised.spoken_name, 'Glycomet');
  assert.equal(preNormalised.name, 'Metformin');
  assert.equal(preNormalised.name_source, 'formulary_match');
  // Idempotent: annotating twice keeps the original spoken name.
  assert.equal(annotateMedicines(data).suspected_medicines[0].spoken_name, 'Glycomet');
});

test('Bolna transcripts parse into turns, including wrapped lines', () => {
  const turns = parseTranscript('assistant: Namaste\nuser: Mujhe chakkar\naa rahe hain\nagent: Kab se?\n');
  assert.deepEqual(turns, [
    { role: 'assistant', text: 'Namaste' },
    { role: 'user', text: 'Mujhe chakkar aa rahe hain' },
    { role: 'assistant', text: 'Kab se?' },
  ]);
});

test('tool arguments drop unfilled templates and "unknown" values', () => {
  const x = toolArgsToExtracted({
    medicine_name: 'Glycomet', onset: '%(onset)s', dosage: 'unknown', reaction_description: 'dizziness',
    patient_age: '62', dechallenge: 'Positive', hospitalised: 'no', other_medicines: 'Telma, none',
  }, 'hi');
  assert.equal(x.suspected_medicines[0].name, 'Metformin');
  assert.equal(x.suspected_medicines[0].dosage, null);
  assert.equal(x.adverse_reactions[0].onset_date, null);
  assert.equal(x.patient.age_group, '62 years');
  assert.equal(x.causality_signals.dechallenge, 'positive');
  assert.equal(x.clinical_context.hospitalization, false);
  assert.deepEqual(x.clinical_context.concomitant_medications, ['Telma']);
});

test('spoken reference reads the last four characters', () => {
  assert.equal(spokenRef('PVP-8F2A91C4'), 'P V P, 9 1 C 4');
});

test('Bolna agent payload uses Sarvam for speech and voice, with tools and webhook', () => {
  const p = buildAgentPayload({ mode: 'intake', lang: 'ta' });
  const tools = p.agent_config.tasks[0].tools_config;
  assert.equal(tools.transcriber.provider, 'sarvam');
  assert.equal(tools.transcriber.language, 'ta');
  assert.equal(tools.synthesizer.provider, 'sarvam');
  assert.deepEqual(tools.api_tools.tools.map((t) => t.name), ['check_emergency', 'lookup_medicine', 'file_adr_report']);
  assert.match(p.agent_config.webhook_url, /^https:\/\/example\.test\/api\/voice\/webhook\?key=/);
  assert.match(p.agent_prompts.task_1.system_prompt, /108/);
  assert.match(p.agent_prompts.task_1.system_prompt, /112/);
});
