export const LANGUAGES = [
  { code: 'en-IN', label: 'English', native: 'English', flag: '🇮🇳' },
  { code: 'hi-IN', label: 'Hindi', native: 'हिंदी', flag: '🇮🇳' },
  { code: 'kn-IN', label: 'Kannada', native: 'ಕನ್ನಡ', flag: '🇮🇳' },
  { code: 'ta-IN', label: 'Tamil', native: 'தமிழ்', flag: '🇮🇳' },
  { code: 'te-IN', label: 'Telugu', native: 'తెలుగు', flag: '🇮🇳' },
  { code: 'mr-IN', label: 'Marathi', native: 'मराठी', flag: '🇮🇳' },
  { code: 'bn-IN', label: 'Bengali', native: 'বাংলা', flag: '🇮🇳' },
  { code: 'gu-IN', label: 'Gujarati', native: 'ગુજરાતી', flag: '🇮🇳' },
  { code: 'ml-IN', label: 'Malayalam', native: 'മലയാളം', flag: '🇮🇳' },
];

export function getLangLabel(code) {
  return LANGUAGES.find((l) => l.code === code)?.native || code;
}

export const TRANSLATIONS = {
  'en-IN': {
    reportTitle: 'Report a Side Effect',
    startConversation: 'Start a Conversation',
    submitReport: 'Submit to PvPI Network',
    reportReady: 'Your report is ready to review',
    emergencyHeading: 'This sounds like a medical emergency',
    emergencyText: 'Please call emergency services immediately or go to your nearest hospital.',
    emergency112: 'National Emergency: 112',
    pvpiHelpline: 'PvPI Helpline: 1800-180-3024',
    continueReporting: 'Continue reporting after seeking help',
    typePlaceholder: 'Type or speak in any language...',
    online: 'Online',
    pharmacoAssistant: 'Pharmaco Assistant',
  },
  'hi-IN': {
    reportTitle: 'साइड इफेक्ट की रिपोर्ट करें',
    startConversation: 'बातचीत शुरू करें',
    submitReport: 'PvPI नेटवर्क को सबमिट करें',
    reportReady: 'आपकी रिपोर्ट समीक्षा के लिए तैयार है',
    emergencyHeading: 'यह एक चिकित्सा आपातकाल जैसा लगता है',
    emergencyText: 'कृपया तुरंत आपातकालीन सेवाओं को कॉल करें या निकटतम अस्पताल जाएं।',
    typePlaceholder: 'किसी भी भाषा में टाइप करें या बोलें...',
  },
};

export function t(key, lang = 'en-IN') {
  return TRANSLATIONS[lang]?.[key] || TRANSLATIONS['en-IN']?.[key] || key;
}
