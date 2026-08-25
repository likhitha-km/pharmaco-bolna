# Pharmaco — India's Conversational Pharmacovigilance Platform

Pharmaco is an AI-powered platform designed to make reporting adverse drug reactions (ADRs) as simple as having a conversation in your own language. It aims to increase ADR reporting in India by removing language barriers, jargon, and complex forms.

Built for the **IEEE WIE Big Idea Pitch** and **AI India Impact Festival**.

## Features

- **Conversational Reporting:** Speak or type in your native Indian language (Hindi, Tamil, Kannada, Marathi, Bengali, Telugu, Gujarati, Malayalam, English).
- **AI-Powered Extraction:** Automatically extracts key clinical information (suspected drug, reaction, onset date, dechallenge/rechallenge) from the conversation.
- **MedDRA Mapping:** Automatically maps patient descriptions to standard WHO MedDRA terminology.
- **Causality Assessment:** Performs initial WHO-UMC causality assessment.
- **ICSR Generation:** Automatically generates structured, regulator-ready Individual Case Safety Reports (ICSR) compliant with CDSCO/PvPI standards.
- **Multilingual Voice Support:** Speak naturally. Voice input is transcribed using Sarvam AI.
- **Regulator Dashboard:** Real-time dashboard for pharmacovigilance experts to track safety signals and review ICSRs.

## Tech Stack

- **Frontend:** React, Vite, Framer Motion, Recharts, Lucide Icons.
- **Backend:** Node.js, Express.js.
- **AI & ML:** Groq (Llama 3.1 & 3.3 for conversational intelligence and data structuring), Sarvam AI (Speech-to-Text).
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
PORT=4000
FRONTEND_URL=http://localhost:5173
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

1. Open your browser to `http://localhost:5173`.
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
