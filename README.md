# Pharmaco — India's Conversational Pharmacovigilance Platform

Pharmaco is an AI-powered platform designed to make reporting adverse drug reactions (ADRs) as simple as having a conversation in your own language. It aims to increase ADR reporting in India by removing language barriers, jargon, and complex forms.

## 🎙️ Pharmaco Voice: Multilingual Voice Based Adverse Drug Reaction Reporting

Reporting happens in the **Pharmaco chat** (`/report`). Voice is the main way in, but it's never required.

1. Tap **Speak** in the chat composer and talk in any of 9 Indian languages (English, Hindi, Kannada, Tamil, Telugu, Marathi, Bengali, Gujarati, Malayalam).
2. The browser records the audio. **Sarvam** speech-to-text (`POST /api/conversation/transcribe`) turns it into text and places it **in the composer for review**. Nothing is sent until the user checks or edits it and presses Send. If Sarvam is unavailable, the browser's own speech recognition is used instead. Mock transcripts are never shown as the user's words.
3. Pharmaco asks follow-up questions to fill missing details. Users can switch between speaking and typing, or change language, at any time. Replies can be read aloud in a **Sarvam Bulbul** voice.
4. When there's enough for a report, an in-chat **"Please check your report"** card shows the details. It marks **the user's own words**, what the **AI interpreted** (translations), and **Pharmaco's brand→generic matches** (Glycomet → Metformin).
5. The user confirms, then reviews and submits. The existing pipeline produces MedDRA coding, WHO-UMC causality, seriousness and the ICSR.

**Safety.** Every message is triaged first. Emergency symptoms get immediate guidance: **112** (national emergency) and **108** (ambulance). That guidance stays pinned above the composer. Pharmaco never diagnoses or tells anyone to stop or change a medicine. "Submit" stores the report in Pharmaco; no government system integration is claimed.

### Following up on incomplete reports
- **In chat (default):** Pharmaco asks for the missing details in the same conversation. The check card lists which optional details are still missing, with an "Answer missing questions" action.
- **Save & resume:** "Save & finish later" keeps a draft. My Reports shows **Continue in chat**, which opens `/report?resume=<id>`. The backend returns a conversation only to the user who started it.
- **Reminders (not yet built):** no email, SMS, WhatsApp or push provider is configured. Building them needs a provider and its credentials, an explicit opt-in consent record per report, a scheduled job, and a signed, expiring return link. No reminders are sent today.
- **Assisted phone follow-up (opt-in preview):** a Bolna call can complete a report. The API refuses unless the reporter's consent is recorded (`consent: true`).

### Demo area (`/demo`)
Four scripted calls run through the real phone-channel pipeline and stream into a live call console showing the transcript, tool calls and the ICSR:
- a Hindi caller on Glycomet
- a Tamil mother whose child got a rash on Mox
- an emergency after a Voveran injection
- a follow-up that completes a half-filled report

Reports from these runs are tagged `demo: true`. The completeness jump in the follow-up scenario (29% → 93%) is a **demo result**, not a measured real-world outcome.

### Optional phone channel (Bolna, needs credits)
A Bolna voice agent ("Priya") uses Sarvam Saaras for speech-to-text and Sarvam Bulbul for its voice. It calls Pharmaco tools during the call (`check_emergency`, `lookup_medicine`, `file_adr_report`), and a webhook processes each finished call. It is **not live**: it needs Bolna credits. It has only been tested with fake webhooks.

```bash
cd backend
cp .env.example .env                                   # BOLNA_API_KEY, SARVAM_API_KEY, VOICE_TOOL_SECRET
npx cloudflared tunnel --url http://localhost:4010     # put the https URL in PUBLIC_BASE_URL
npm run bolna:dry-run && npm run bolna:setup
```

### Tests
`cd backend && npm test` runs 16 tests offline. Firebase, Nebius, Sarvam and Bolna are all disabled, so the suite never touches real data. It covers:
- chat voice flags, emergency guidance, resume ownership, drafts, and the no-mock transcription rule
- Bolna tool and webhook auth, duplicate webhooks, and the follow-up consent gate
- all four demo scenarios, end to end

`npm run voice:reset` clears demo voice data from Firestore (`--all-voice` clears every voice call; `--dry-run` previews).

## Features

- **Conversational Reporting:** Speak or type in your native Indian language (Hindi, Tamil, Kannada, Marathi, Bengali, Telugu, Gujarati, Malayalam, English).
- **AI-Powered Extraction:** Automatically extracts key clinical information (suspected drug, reaction, onset date, dechallenge/rechallenge) from the conversation.
- **MedDRA Mapping:** Automatically maps patient descriptions to standard WHO MedDRA terminology.
- **Causality Assessment:** Performs initial WHO-UMC causality assessment.
- **ICSR Generation:** Automatically generates structured, regulator-ready Individual Case Safety Reports (ICSR) compliant with CDSCO/PvPI standards.
- **Multilingual Voice Support:** Tap Speak in the chat. Sarvam transcribes, you review the text, then send. Replies can be read aloud.
- **Regulator Dashboard:** Real-time dashboard for pharmacovigilance experts to track safety signals and review ICSRs.

## Tech Stack

- **Frontend:** React, Vite, Framer Motion, Recharts, Lucide Icons.
- **Backend:** Node.js, Express.js.
- **Voice:** Bolna (voice agents, telephony, tool calling, webhooks), Sarvam AI (Saaras STT, Bulbul TTS, Mayura translation).
- **AI & ML:** Nebius-hosted Qwen3 for extraction, MedDRA mapping, causality and ICSR generation.
- **Database (Demo Mode):** Firebase / In-memory storage.

## Getting Started

### Prerequisites

- Node.js (v18+)
- npm

### 1. Setup Backend

\`\`\`bash
cd backend
npm install
\`\`\`

Create a `.env` file in the `backend` directory (using `.env.example` as a template, if any, or just use the generated `.env`):
\`\`\`
GROQ_API_KEY=your_groq_api_key
SARVAM_API_KEY=your_sarvam_api_key
PORT=4010
FRONTEND_URL=http://localhost:5180
\`\`\`
*Note: The platform includes a robust offline/demo mode. If you do not provide valid Groq or Sarvam API keys, it will gracefully fall back to a simulated intelligence engine designed specifically for the hackathon demo.*

Start the backend server:
\`\`\`bash
npm run dev
\`\`\`

### 2. Setup Frontend

\`\`\`bash
cd frontend
npm install
\`\`\`

Start the frontend development server:
\`\`\`bash
npm run dev
\`\`\`

### 3. Usage

1. Open your browser to `http://localhost:5180`.
2. Click "Report a Side Effect" to start a new conversation.
3. Select your preferred language and start chatting! For the best demo experience without API keys, try mentioning "Metformin", "Amoxicillin", or "Atorvastatin".

## Architecture

Pharmaco employs a multi-agent AI architecture:
- **Triage Agent:** Screens for medical emergencies in real-time.
- **Conversation Agent:** Conducts a natural, empathetic interview to collect required ICSR fields.
- **Extraction Agent:** Converts unstructured conversational history into structured JSON.
- **Mapping Agent:** Maps terms to MedDRA and performs causality assessment.
- **Completeness Agent:** Validates the collected data against PvPI requirements.
- **Report Agent:** Synthesizes all data into a final narrative and structured ICSR.

## Authentication System

### Firebase Console Setup

1. Enable Google OAuth:
	 Authentication > Sign-in method > Google > Enable
	 Add authorized domains: `localhost` and your production domain.

2. Enable Email/Password:
	 Authentication > Sign-in method > Email/Password > Enable

3. Add Firestore security rules (Firestore Database > Rules):

```txt
rules_version = '2';
service cloud.firestore {
	match /databases/{database}/documents {
		match /users/{userId} {
			allow read: if request.auth != null
				&& request.auth.uid == userId;
			allow create: if request.auth != null
				&& request.auth.uid == userId;
			allow update: if request.auth != null
				&& request.auth.uid == userId;
			allow delete: if false;
		}
	}
}
```

4. Customize auth email templates (manual in console):
	 Firebase Console > Authentication > Templates
	 Update templates for Email verification, Password reset, and Email change notification.
	 Set sender name to `Pharmaco`.

Recommended subjects:
- Verification: `Verify your Pharmaco account`
- Password reset: `Reset your Pharmaco password`
- Email change: `Your Pharmaco email has been updated`

Note: email template customization must be done manually in Firebase Console and cannot be configured through the Firebase SDK.

### Supported Login Methods

- Email address + password
- Username + password
- Pharmaco ID + password

### Pharmaco ID Format

Every account receives a permanent ID with this format:

`PHR-YYYY-XXXXXX`

- `YYYY`: current year
- `XXXXXX`: uppercase alphanumeric code

Users can find this ID on the signup confirmation screen and in their profile data.

### Role Permissions

- `patient`: can report ADRs, view drug profiles, track own reports, receive alerts
- `healthcare_professional`: all patient features plus clinical reporting tools and institutional analytics
- `admin`: full platform access (assigned manually in Firestore, no public signup path)

## License

This project was built for hackathon demonstration purposes.
