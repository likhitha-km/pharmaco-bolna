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

// ── Safety-critical UI strings, in every supported language ──────────────────
// The emergency banner, the "call 112/108" buttons and connection errors must
// always be shown in the conversation language — never fall back to English
// just because a translation is missing. Wording should be reviewed by native
// speakers before release.
const SUFFIX = {
  'en-IN': 'If you feel seriously unwell, call 112 or 108.',
  'hi-IN': 'अगर आपकी तबीयत गंभीर रूप से खराब लग रही है, तो 112 या 108 पर कॉल करें।',
  'kn-IN': 'ನಿಮಗೆ ತೀವ್ರ ಅಸ್ವಸ್ಥತೆ ಅನಿಸಿದರೆ 112 ಅಥವಾ 108 ಗೆ ಕರೆ ಮಾಡಿ.',
  'ta-IN': 'மிகவும் உடல்நலக்குறைவு தோன்றினால் 112 அல்லது 108 ஐ அழைக்கவும்.',
  'te-IN': 'మీకు తీవ్రంగా అనారోగ్యంగా అనిపిస్తే 112 లేదా 108 కి కాల్ చేయండి.',
  'mr-IN': 'तुम्हाला गंभीर अस्वस्थ वाटत असेल तर 112 किंवा 108 वर कॉल करा.',
  'bn-IN': 'যদি আপনি গুরুতর অসুস্থ বোধ করেন, 112 বা 108 নম্বরে কল করুন।',
  'gu-IN': 'જો તમને ગંભીર અસ્વસ્થતા લાગે તો 112 અથવા 108 પર કૉલ કરો.',
  'ml-IN': 'നിങ്ങൾക്ക് ഗുരുതരമായി അസ്വസ്ഥത തോന്നുന്നുവെങ്കിൽ 112 അല്ലെങ്കിൽ 108 വിളിക്കുക.',
};

export const SAFETY_STRINGS = {
  'en-IN': {
    emergencyHeading: 'This could be a medical emergency',
    emergencyText: 'Please call emergency services now or go to your nearest hospital.',
    nationalEmergency: 'National Emergency: 112',
    ambulance: 'Ambulance: 108',
    helpline: 'PvPI Helpline: 1800-180-3024',
    continueReporting: 'Continue reporting after getting help',
    emergencyBar: 'Emergency?',
    showAdvice: 'Show advice',
    connectionError: "I'm having trouble connecting. Your conversation is saved — please try again.",
    offlineWelcome: "Hi there! I'm Pharmaco's assistant, here to help you report a medicine side effect safely and confidentially. Please share what's been bothering you.",
  },
  'hi-IN': {
    emergencyHeading: 'यह एक चिकित्सा आपातकाल हो सकता है',
    emergencyText: 'कृपया अभी आपातकालीन सेवाओं को कॉल करें या नज़दीकी अस्पताल जाएं।',
    nationalEmergency: 'राष्ट्रीय आपातकाल: 112',
    ambulance: 'एम्बुलेंस: 108',
    helpline: 'PvPI हेल्पलाइन: 1800-180-3024',
    continueReporting: 'मदद मिलने के बाद रिपोर्ट जारी रखें',
    emergencyBar: 'आपातकाल?',
    showAdvice: 'सलाह दिखाएं',
    connectionError: 'कनेक्ट करने में दिक्कत हो रही है। आपकी बातचीत सुरक्षित है, कृपया फिर से कोशिश करें।',
    offlineWelcome: 'नमस्ते! मैं Pharmaco का सहायक हूं। आप बेझिझक बताएं कि क्या हो रहा है।',
  },
  'kn-IN': {
    emergencyHeading: 'ಇದು ವೈದ್ಯಕೀಯ ತುರ್ತು ಪರಿಸ್ಥಿತಿಯಾಗಿರಬಹುದು',
    emergencyText: 'ದಯವಿಟ್ಟು ಈಗಲೇ ತುರ್ತು ಸೇವೆಗೆ ಕರೆ ಮಾಡಿ ಅಥವಾ ಹತ್ತಿರದ ಆಸ್ಪತ್ರೆಗೆ ಹೋಗಿ.',
    nationalEmergency: 'ರಾಷ್ಟ್ರೀಯ ತುರ್ತು: 112',
    ambulance: 'ಆಂಬ್ಯುಲೆನ್ಸ್: 108',
    helpline: 'PvPI ಸಹಾಯವಾಣಿ: 1800-180-3024',
    continueReporting: 'ಸಹಾಯ ಪಡೆದ ನಂತರ ವರದಿ ಮುಂದುವರಿಸಿ',
    emergencyBar: 'ತುರ್ತು?',
    showAdvice: 'ಸಲಹೆ ತೋರಿಸಿ',
    connectionError: 'ಸಂಪರ್ಕಿಸಲು ತೊಂದರೆ ಆಗುತ್ತಿದೆ. ನಿಮ್ಮ ಸಂಭಾಷಣೆ ಉಳಿದಿದೆ, ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
    offlineWelcome: 'ನಮಸ್ಕಾರ! ನಾನು Pharmaco ಸಹಾಯಕ. ನಿಮಗೆ ಏನಾಯಿತು ಎಂದು ನಿರಾಳವಾಗಿ ಹೇಳಿ.',
  },
  'ta-IN': {
    emergencyHeading: 'இது மருத்துவ அவசரநிலையாக இருக்கலாம்',
    emergencyText: 'தயவுசெய்து இப்போதே அவசர சேவையை அழைக்கவும் அல்லது அருகிலுள்ள மருத்துவமனைக்குச் செல்லவும்.',
    nationalEmergency: 'தேசிய அவசரம்: 112',
    ambulance: 'ஆம்புலன்ஸ்: 108',
    helpline: 'PvPI உதவி எண்: 1800-180-3024',
    continueReporting: 'உதவி பெற்ற பிறகு அறிக்கையைத் தொடரவும்',
    emergencyBar: 'அவசரமா?',
    showAdvice: 'ஆலோசனையைக் காட்டு',
    connectionError: 'இணைப்பதில் சிக்கல் உள்ளது. உங்கள் உரையாடல் சேமிக்கப்பட்டுள்ளது, மீண்டும் முயற்சிக்கவும்.',
    offlineWelcome: 'வணக்கம்! நான் Pharmaco உதவியாளர். நடந்தது என்னவென்று மனம் விட்டுச் சொல்லுங்கள்.',
  },
  'te-IN': {
    emergencyHeading: 'ఇది వైద్య అత్యవసర పరిస్థితి కావచ్చు',
    emergencyText: 'దయచేసి వెంటనే అత్యవసర సేవలకు కాల్ చేయండి లేదా సమీప ఆసుపత్రికి వెళ్లండి.',
    nationalEmergency: 'జాతీయ అత్యవసరం: 112',
    ambulance: 'అంబులెన్స్: 108',
    helpline: 'PvPI హెల్ప్‌లైన్: 1800-180-3024',
    continueReporting: 'సహాయం పొందిన తర్వాత నివేదికను కొనసాగించండి',
    emergencyBar: 'అత్యవసరమా?',
    showAdvice: 'సలహా చూపండి',
    connectionError: 'కనెక్ట్ అవడంలో ఇబ్బంది ఉంది. మీ సంభాషణ భద్రంగా ఉంది, దయచేసి మళ్ళీ ప్రయత్నించండి.',
    offlineWelcome: 'నమస్కారం! నేను Pharmaco సహాయకుడిని. మీకు ఏమి జరిగిందో నిరభ్యంతరంగా చెప్పండి.',
  },
  'mr-IN': {
    emergencyHeading: 'ही वैद्यकीय आणीबाणी असू शकते',
    emergencyText: 'कृपया आत्ताच आपत्कालीन सेवेला कॉल करा किंवा जवळच्या रुग्णालयात जा.',
    nationalEmergency: 'राष्ट्रीय आणीबाणी: 112',
    ambulance: 'रुग्णवाहिका: 108',
    helpline: 'PvPI हेल्पलाइन: 1800-180-3024',
    continueReporting: 'मदत मिळाल्यानंतर अहवाल सुरू ठेवा',
    emergencyBar: 'आणीबाणी?',
    showAdvice: 'सल्ला दाखवा',
    connectionError: 'कनेक्ट होण्यात अडचण येत आहे. तुमचे संभाषण जतन केले आहे, कृपया पुन्हा प्रयत्न करा.',
    offlineWelcome: 'नमस्कार! मी Pharmaco चा सहाय्यक आहे. तुम्हाला काय झालं ते मोकळेपणाने सांगा.',
  },
  'bn-IN': {
    emergencyHeading: 'এটি চিকিৎসা জরুরি অবস্থা হতে পারে',
    emergencyText: 'অনুগ্রহ করে এখনই জরুরি পরিষেবায় কল করুন বা নিকটতম হাসপাতালে যান।',
    nationalEmergency: 'জাতীয় জরুরি: 112',
    ambulance: 'অ্যাম্বুলেন্স: 108',
    helpline: 'PvPI হেল্পলাইন: 1800-180-3024',
    continueReporting: 'সাহায্য পাওয়ার পর রিপোর্ট চালিয়ে যান',
    emergencyBar: 'জরুরি?',
    showAdvice: 'পরামর্শ দেখান',
    connectionError: 'সংযোগ করতে সমস্যা হচ্ছে। আপনার কথোপকথন সংরক্ষিত আছে, অনুগ্রহ করে আবার চেষ্টা করুন।',
    offlineWelcome: 'নমস্কার! আমি Pharmaco-এর সহায়ক। কী হয়েছে তা নিঃসংকোচে বলুন।',
  },
  'gu-IN': {
    emergencyHeading: 'આ તબીબી કટોકટી હોઈ શકે છે',
    emergencyText: 'કૃપા કરીને હમણાં જ કટોકટી સેવાને કૉલ કરો અથવા નજીકની હોસ્પિટલમાં જાઓ.',
    nationalEmergency: 'રાષ્ટ્રીય કટોકટી: 112',
    ambulance: 'એમ્બ્યુલન્સ: 108',
    helpline: 'PvPI હેલ્પલાઇન: 1800-180-3024',
    continueReporting: 'મદદ મળ્યા પછી રિપોર્ટ ચાલુ રાખો',
    emergencyBar: 'કટોકટી?',
    showAdvice: 'સલાહ બતાવો',
    connectionError: 'કનેક્ટ કરવામાં તકલીફ છે. તમારી વાતચીત સચવાયેલી છે, કૃપા કરીને ફરી પ્રયાસ કરો.',
    offlineWelcome: 'નમસ્કાર! હું Pharmaco નો સહાયક છું. શું થયું તે નિઃસંકોચ જણાવો.',
  },
  'ml-IN': {
    emergencyHeading: 'ഇത് ഒരു മെഡിക്കൽ അടിയന്തരാവസ്ഥയാകാം',
    emergencyText: 'ദയവായി ഇപ്പോൾ തന്നെ അടിയന്തര സേവനത്തെ വിളിക്കുക അല്ലെങ്കിൽ അടുത്തുള്ള ആശുപത്രിയിലേക്ക് പോകുക.',
    nationalEmergency: 'ദേശീയ അടിയന്തരം: 112',
    ambulance: 'ആംബുലൻസ്: 108',
    helpline: 'PvPI ഹെൽപ്പ്‌ലൈൻ: 1800-180-3024',
    continueReporting: 'സഹായം ലഭിച്ച ശേഷം റിപ്പോർട്ട് തുടരുക',
    emergencyBar: 'അടിയന്തരമോ?',
    showAdvice: 'നിർദ്ദേശം കാണിക്കുക',
    connectionError: 'കണക്റ്റ് ചെയ്യുന്നതിൽ പ്രശ്നമുണ്ട്. നിങ്ങളുടെ സംഭാഷണം സംരക്ഷിച്ചിട്ടുണ്ട്, ദയവായി വീണ്ടും ശ്രമിക്കുക.',
    offlineWelcome: 'നമസ്‌കാരം! ഞാൻ Pharmaco-യുടെ സഹായകനാണ്. എന്ത് സംഭവിച്ചു എന്ന് നിർഭയമായി പറയൂ.',
  },
};

// The "seriously unwell → 112/108" line rides along with the connection error,
// so a patient whose message could not be delivered is still told what to do.
for (const [code, strings] of Object.entries(SAFETY_STRINGS)) {
  strings.connectionError = `${strings.connectionError} ${SUFFIX[code]}`;
}

/** Safety-critical string in the conversation language. Falls back to English only for an unknown language code. */
export function tSafety(key, lang = 'en-IN') {
  return (SAFETY_STRINGS[lang] || SAFETY_STRINGS['en-IN'])[key] ?? SAFETY_STRINGS['en-IN'][key] ?? key;
}
