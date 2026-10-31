// Languages Pharmaco Voice supports on a phone call. `code` is the plain
// language code Bolna's Sarvam transcriber/synthesizer expect ("hi", not
// "hi-IN"); `bcp47` is what the rest of Pharmaco (web chat, Sarvam REST) uses.
export const VOICE_LANGUAGES = {
  hi: { code: 'hi', bcp47: 'hi-IN', name: 'Hindi', native: 'हिन्दी' },
  en: { code: 'en', bcp47: 'en-IN', name: 'English', native: 'English' },
  kn: { code: 'kn', bcp47: 'kn-IN', name: 'Kannada', native: 'ಕನ್ನಡ' },
  ta: { code: 'ta', bcp47: 'ta-IN', name: 'Tamil', native: 'தமிழ்' },
  te: { code: 'te', bcp47: 'te-IN', name: 'Telugu', native: 'తెలుగు' },
  mr: { code: 'mr', bcp47: 'mr-IN', name: 'Marathi', native: 'मराठी' },
  bn: { code: 'bn', bcp47: 'bn-IN', name: 'Bengali', native: 'বাংলা' },
  gu: { code: 'gu', bcp47: 'gu-IN', name: 'Gujarati', native: 'ગુજરાતી' },
  ml: { code: 'ml', bcp47: 'ml-IN', name: 'Malayalam', native: 'മലയാളം' },
};

/** Accepts "hi", "hi-IN", "HI" … and returns the plain code, defaulting to Hindi. */
export function toVoiceLang(lang) {
  const code = String(lang || 'hi').toLowerCase().split('-')[0];
  return VOICE_LANGUAGES[code] ? code : 'hi';
}

export const WELCOME = {
  hi: 'नमस्ते, मैं Pharmaco से प्रिया बोल रही हूँ। आप किसी दवाई के side effect के बारे में बताना चाहते हैं? आराम से बताइए, मैं सुन रही हूँ।',
  en: 'Hello, this is Priya from Pharmaco. I can help you report a side effect from a medicine. Please tell me what happened, in your own words.',
  kn: 'ನಮಸ್ಕಾರ, ನಾನು Pharmaco ಇಂದ ಪ್ರಿಯಾ. ಯಾವುದಾದರೂ ಔಷಧಿಯ side effect ಬಗ್ಗೆ ಹೇಳಬೇಕೇ? ಏನಾಯಿತು ಎಂದು ನಿಧಾನವಾಗಿ ಹೇಳಿ.',
  ta: 'வணக்கம், நான் Pharmaco-விலிருந்து பிரியா. ஏதேனும் மருந்தின் side effect பற்றி சொல்ல வேண்டுமா? என்ன நடந்தது என்று சொல்லுங்கள்.',
  te: 'నమస్కారం, నేను Pharmaco నుండి ప్రియ. ఏదైనా మందు వల్ల side effect వచ్చిందా? ఏమి జరిగిందో చెప్పండి.',
  mr: 'नमस्कार, मी Pharmaco मधून प्रिया बोलतेय. एखाद्या औषधाचा side effect झाला आहे का? काय झालं ते सांगा.',
  bn: 'নমস্কার, আমি Pharmaco থেকে প্রিয়া বলছি। কোনো ওষুধের side effect হয়েছে? কী হয়েছে বলুন।',
  gu: 'નમસ્તે, હું Pharmaco થી પ્રિયા બોલું છું. કોઈ દવાની side effect થઈ છે? શું થયું તે કહો.',
  ml: 'നമസ്കാരം, ഞാൻ Pharmaco-യിൽ നിന്ന് പ്രിയ. ഏതെങ്കിലും മരുന്നിന്റെ side effect ഉണ്ടായോ? എന്താണ് സംഭവിച്ചതെന്ന് പറയൂ.',
};

export const FOLLOWUP_WELCOME = {
  hi: 'नमस्ते, मैं Pharmaco से प्रिया बोल रही हूँ। आपने जो side effect report किया था, उसके बारे में दो-तीन छोटे सवाल पूछने थे। क्या अभी दो मिनट बात हो सकती है?',
  en: 'Hello, this is Priya from Pharmaco, calling about the side effect you reported. I have two or three quick questions to complete your report. Is now a good time?',
  kn: 'ನಮಸ್ಕಾರ, ನಾನು Pharmaco ಇಂದ ಪ್ರಿಯಾ. ನೀವು report ಮಾಡಿದ side effect ಬಗ್ಗೆ ಎರಡು-ಮೂರು ಸಣ್ಣ ಪ್ರಶ್ನೆಗಳಿವೆ. ಈಗ ಎರಡು ನಿಮಿಷ ಮಾತನಾಡಬಹುದೇ?',
};
