import { v4 as uuidv4 } from 'uuid';
import { saveConversation, saveReport } from '../services/firebaseService.js';
import { assessCompleteness } from '../agents/completenessAgent.js';
import { mergeExtractedData } from '../utils/extractedData.js';
import { WELCOME, FOLLOWUP_WELCOME } from './languages.js';
import { upsertCall, pushEvent, getCall } from './voiceStore.js';
import { toolCheckEmergency, toolLookupMedicine, toolFileReport, toolUpdateReport, processCompletedCall } from './callPipeline.js';

// Scripted calls for demos and for building before Bolna credits land. The
// script only stands in for the two humans on the line — every tool call,
// emergency triage, report, MedDRA code and ICSR is produced by the real
// pipeline, exactly as it would be for a live Bolna call.

const A = (text) => ({ role: 'assistant', text });
const U = (text, en) => ({ role: 'user', text, en });
const T = (tool, args) => ({ tool, args });

export const SCENARIOS = {
  'hi-metformin': {
    title: 'Daughter reports father’s dizziness on Glycomet',
    language: 'hi',
    mode: 'intake',
    highlight: 'A daughter calls about her father’s dizziness after starting a diabetes tablet. Priya confirms the details and saves the report while they talk.',
    steps: [
      A(WELCOME.hi),
      U('हाँ जी, मेरे पापा को डॉक्टर ने Glycomet शुरू की थी, उसके बाद से उनको चक्कर आते हैं और हाथ काँपते हैं।', 'Yes, the doctor started my father on Glycomet, and since then he gets dizzy and his hands shake.'),
      T('lookup_medicine', { medicine_name: 'Glycomet' }),
      A('अच्छा, Glycomet यानी Metformin। बताने के लिए धन्यवाद। पापा इसे कितने mg और दिन में कितनी बार लेते हैं?'),
      U('500 mg, दिन में दो बार, खाने के बाद। sugar के लिए दी थी।', '500 mg, twice a day, after food. It was given for sugar (diabetes).'),
      A('समझ गई। चक्कर और हाथ काँपना दवा शुरू करने के कितने दिन बाद शुरू हुआ?'),
      U('करीब चार-पाँच दिन बाद। एक बार तो बाथरूम में गिरते-गिरते बचे।', 'About four or five days later. Once he nearly fell in the bathroom.'),
      A('ओह, ये चिंता की बात है। क्या डॉक्टर ने दवा बंद की या कम की? उसके बाद कुछ फर्क पड़ा?'),
      U('हाँ, डॉक्टर ने तीन दिन पहले बंद करवा दी, अब चक्कर काफी कम है।', 'Yes, the doctor stopped it three days ago; the dizziness is much less now.'),
      A('अच्छी बात है। पापा कोई और दवाई भी रोज़ लेते हैं? और उनकी उम्र कितनी है?'),
      U('BP के लिए Telma लेते हैं। उम्र 62 साल है।', 'He takes Telma for BP. He is 62 years old.'),
      A('ठीक है, मैं confirm कर लूँ — 62 साल के पुरुष, Metformin 500 mg दिन में दो बार, चार-पाँच दिन बाद चक्कर और हाथ काँपना, और दवा बंद करने पर आराम है। सही है?'),
      U('हाँ जी, बिल्कुल सही।', 'Yes, exactly right.'),
      T('file_adr_report', {
        medicine_name: 'Glycomet', dosage: '500 mg', frequency: 'twice a day after food', reason_for_taking: 'type 2 diabetes',
        reaction_description: 'dizziness and tremor of hands, with one near-fall', reaction_original: 'चक्कर आना और हाथ काँपना',
        severity: 'moderate', onset: '4-5 days after starting', dechallenge: 'positive', rechallenge: 'not_applicable',
        other_medicines: 'Telma (telmisartan)', medical_history: 'type 2 diabetes, hypertension', outcome: 'recovering',
        hospitalised: 'no', patient_age: '62', patient_gender: 'male', reporter_type: 'caregiver',
      }),
      A('आपकी report दर्ज हो गई है। आपका reference number है — {ref}। आपने बाकी लोगों के लिए दवाइयाँ सुरक्षित बनाने में मदद की है। धन्यवाद, पापा का ध्यान रखिए।'),
    ],
  },

  'ta-amoxicillin': {
    title: 'Mother reports child’s rash on Mox syrup (Tamil)',
    language: 'ta',
    mode: 'intake',
    highlight: 'A mother reports a rash on her child, in Tamil. Priya checks for danger signs and asks the right questions.',
    steps: [
      A(WELCOME.ta),
      U('என் மகனுக்கு Mox syrup கொடுத்தோம், இரண்டாவது நாள் உடம்பு முழுக்க சிவப்பா தடிப்பு வந்துச்சு, ரொம்ப அரிக்குது.', 'We gave my son Mox syrup; on the second day red rashes came all over his body and it itches a lot.'),
      T('lookup_medicine', { medicine_name: 'Mox' }),
      A('சரி, Mox என்பது Amoxicillin. உங்கள் மகனுக்கு எத்தனை வயது? எதற்காக கொடுத்தீர்கள்?'),
      U('எட்டு வயது. காய்ச்சலுக்கு டாக்டர் கொடுத்தார்.', 'Eight years old. The doctor gave it for fever.'),
      A('மூச்சு விடுவதில் சிரமம் அல்லது முகம் வீக்கம் ஏதாவது இருந்ததா?'),
      U('இல்லை, அப்படி எதுவும் இல்லை. தடிப்பும் அரிப்பும் தான்.', 'No, nothing like that. Only the rash and itching.'),
      A('நல்லது. மருந்தை நிறுத்தினீர்களா? அதற்குப் பிறகு எப்படி இருக்கிறது?'),
      U('ஆமாம், நிறுத்திட்டோம். இப்போ தடிப்பு குறைஞ்சிருக்கு.', 'Yes, we stopped it. The rash has reduced now.'),
      A('சரி, எட்டு வயது பையன், Amoxicillin syrup, இரண்டாவது நாள் தடிப்பும் அரிப்பும், நிறுத்திய பிறகு குறைந்தது. சரியா?'),
      U('சரி தான்.', 'That is correct.'),
      T('file_adr_report', {
        medicine_name: 'Mox', reason_for_taking: 'fever', reaction_description: 'generalised red itchy rash',
        reaction_original: 'உடம்பு முழுக்க சிவப்பா தடிப்பு, அரிப்பு', severity: 'moderate', onset: 'day 2 of treatment',
        dechallenge: 'positive', outcome: 'recovering', patient_age: '8', patient_gender: 'male', reporter_type: 'caregiver',
      }),
      A('உங்கள் report பதிவாகிவிட்டது. Reference number — {ref}. மிக்க நன்றி, குழந்தையைப் பார்த்துக்கொள்ளுங்கள்.'),
    ],
  },

  'hi-emergency': {
    title: 'Caller with throat swelling after Voveran injection',
    language: 'hi',
    mode: 'intake',
    highlight: 'Face swelling after an injection. Priya spots the danger, tells the caller to get emergency help, and still saves the report.',
    steps: [
      A(WELCOME.hi),
      U('मैडम, दो घंटे पहले मैंने Voveran का injection लगवाया था, अब मेरा चेहरा सूज रहा है और साँस लेने में बहुत तकलीफ हो रही है।', 'Madam, I got a Voveran injection two hours ago; now my face is swelling and I am having a lot of trouble breathing.'),
      T('check_emergency', { symptoms: 'face swelling and difficulty breathing two hours after Voveran (diclofenac) injection' }),
      A('ये emergency हो सकती है। कृपया अभी तुरंत 108 पर ambulance के लिए call कीजिए, या 112 पर, या सबसे पास के hospital की emergency में जाइए। अभी।'),
      U('ठीक है, मैं जा रहा हूँ।', 'Okay, I am going.'),
      A('जल्दी जाइए। आपकी जानकारी हम serious report के रूप में दर्ज कर रहे हैं। अपना ध्यान रखिए।'),
    ],
  },

  'hi-followup': {
    title: 'AI follow-up call completes a half-filled report',
    language: 'hi',
    mode: 'followup',
    highlight: 'Priya follows up on a half-filled report and completes the missing details.',
    seed: {
      extractedData: {
        suspected_medicines: [{ name: 'Atorvastatin', brand_name: 'Storvas', confidence: 0.9 }],
        adverse_reactions: [{ original_text: 'पैरों में बहुत दर्द', english_translation: 'severe pain in both legs', confidence: 0.9 }],
        metadata: { language_detected: 'hi-IN', reporter_type: 'patient', report_type: 'adr' },
      },
    },
    steps: [
      A(FOLLOWUP_WELCOME.hi),
      U('हाँ, बोलिए।', 'Yes, go ahead.'),
      A('आपने Storvas लेने के बाद पैरों में दर्द की शिकायत की थी। ये दवा आप कितने mg और कब लेते हैं?'),
      U('Storvas 40, रात को एक गोली।', 'Storvas 40, one tablet at night.'),
      A('दर्द दवा शुरू करने के कितने दिन बाद शुरू हुआ था?'),
      U('लगभग तीन हफ्ते बाद।', 'About three weeks later.'),
      A('क्या दवा बंद करने पर दर्द कम हुआ?'),
      U('हाँ, डॉक्टर ने एक हफ्ता बंद करवाई तो दर्द चला गया।', 'Yes, when the doctor stopped it for a week the pain went away.'),
      A('आपकी उम्र कितनी है, और कोई और दवाई भी लेते हैं?'),
      U('58 साल। sugar के लिए Metformin लेता हूँ।', 'I am 58. I take Metformin for sugar.'),
      A('अभी आप कैसा महसूस कर रहे हैं?'),
      U('अब ठीक हूँ, दर्द नहीं है।', 'I am fine now, there is no pain.'),
      T('update_adr_report', {
        report_id: '{report_id}', dosage: '40 mg', frequency: 'once daily at night', onset: 'about 3 weeks after starting',
        dechallenge: 'positive', patient_age: '58', patient_gender: 'male', other_medicines: 'Metformin',
        medical_history: 'type 2 diabetes', outcome: 'recovered', reason_for_taking: 'high cholesterol',
      }),
      A('बहुत धन्यवाद, आपकी report अब पूरी हो गई है। अपना ध्यान रखिए।'),
    ],
  },
};

export function listScenarios() {
  return Object.entries(SCENARIOS).map(([id, s]) => ({ id, title: s.title, language: s.language, mode: s.mode, highlight: s.highlight }));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pace = (text, speed) => Math.min(4200, Math.max(1100, text.length * 38)) / speed;

/** Seed the incomplete web-chat report that the follow-up scenario completes. */
async function seedReport(seed) {
  const reportId = `PVP-${uuidv4().slice(0, 8).toUpperCase()}`;
  const extractedData = mergeExtractedData(null, seed.extractedData);
  const completeness = await assessCompleteness(extractedData);
  const conversationId = `seed-${reportId}`;
  await saveConversation({
    id: conversationId,
    userId: 'voice-line',
    messages: [{ role: 'user', content: 'Storvas lene ke baad pairon mein bahut dard', timestamp: new Date().toISOString() }],
    extractedData,
    language: 'hi-IN',
    userType: 'patient',
    status: 'report_ready',
  });
  await saveReport({
    id: reportId,
    conversationId,
    userId: 'voice-line',
    extractedData,
    completenessScore: completeness.completeness_score,
    status: 'submitted',
    language: 'hi-IN',
    channel: 'web',
    demo: true,
    title: 'Atorvastatin',
    reaction: 'severe pain in both legs',
  });
  return { reportId, completeness: completeness.completeness_score };
}

/**
 * Run a scripted call. Returns the call id immediately; the call then plays
 * out over ~30–60s, streaming events to the console.
 */
export async function startScenario(scenarioId, { speed = 1, ownerId } = {}) {
  const scenario = SCENARIOS[scenarioId];
  if (!scenario) throw new Error(`Unknown scenario: ${scenarioId}`);

  const callId = `sim-${uuidv4().slice(0, 8)}`;
  let reportId = null;
  if (scenario.seed) ({ reportId } = await seedReport(scenario.seed));

  upsertCall(callId, {
    source: 'simulation',
    scenarioId,
    title: scenario.title,
    mode: scenario.mode,
    language: scenario.language,
    direction: scenario.mode === 'followup' ? 'outbound' : 'inbound',
    callerMasked: '•••• 4821',
    ownerId,
    reportId: reportId || undefined,
    status: 'queued',
  });

  run(callId, scenario, { speed: Math.max(0.25, Math.min(4, Number(speed) || 1)), reportId }).catch((err) => {
    console.error('[Simulation] failed:', err);
    pushEvent(callId, 'call.ended', { status: 'error', note: err.message });
  });
  return callId;
}

async function run(callId, scenario, { speed, reportId }) {
  const startedAt = Date.now();

  for (const status of ['ringing', 'in-progress']) {
    upsertCall(callId, { status });
    pushEvent(callId, 'call.status', { status });
    await sleep(900 / speed);
  }

  let ref = null;
  for (const step of scenario.steps) {
    if (step.tool) {
      const args = { ...step.args, call_language: scenario.language, call_mode: scenario.mode };
      if (args.report_id === '{report_id}') args.report_id = reportId;
      await sleep(400 / speed);
      if (step.tool === 'check_emergency') await toolCheckEmergency(callId, args);
      if (step.tool === 'lookup_medicine') await toolLookupMedicine(callId, args);
      if (step.tool === 'file_adr_report') ref = (await toolFileReport(callId, args)).spoken_reference;
      if (step.tool === 'update_adr_report') await toolUpdateReport(callId, args);
      continue;
    }

    // Scripted calls carry their own reviewed English; real calls are
    // translated by Sarvam Mayura in processCompletedCall.
    const text = step.text.replace('{ref}', ref || '');
    pushEvent(callId, 'transcript.turn', { role: step.role, text, text_en: step.role === 'user' ? step.en || null : null });
    await sleep(pace(text, speed));
  }

  const durationSec = Math.round(((Date.now() - startedAt) / 1000) * speed);
  upsertCall(callId, { status: 'completed', durationSec, processed: true });
  pushEvent(callId, 'call.status', { status: 'completed' });

  const call = getCall(callId);
  await processCompletedCall(callId, call.transcript.map((t) => ({ role: t.role, text: t.text })));
}
