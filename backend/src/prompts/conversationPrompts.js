// Welcome messages — shown once at the start of every conversation.
// Keep them warm and open-ended. Do NOT ask for the medicine name directly here;
// let the conversational AI guide that naturally after the user has settled in.
export const WELCOME_MESSAGES = {
  'en-IN': "Hi there! I'm Pharmaco's assistant, here to help you report a medicine side effect safely and confidentially. Please share what's been bothering you — as much or as little as you'd like to start.",
  'hi-IN': "नमस्ते! मैं Pharmaco का सहायक हूं। आप बेझिझक बताएं कि क्या हो रहा है — जितना चाहें उतना।",
  'kn-IN': "ನಮಸ್ಕಾರ! ನಾನು Pharmaco ಸಹಾಯಕ. ನಿಮಗೆ ಏನಾಯಿತು ಎಂದು ನಿರಾಳವಾಗಿ ಹೇಳಿ — ಎಷ್ಟು ಬೇಕಾದರೂ ಹೇಳಬಹುದು.",
  'ta-IN': "வணக்கம்! நான் Pharmaco உதவியாளர். நடந்தது என்னவென்று மனம் விட்டுச் சொல்லுங்கள் — எவ்வளவு வேண்டுமானாலும்.",
  'te-IN': "నమస్కారం! నేను Pharmaco సహాయకుడిని. మీకు ఏమి జరిగిందో నిరభ్యంతరంగా చెప్పండి — ఎంత అయినా పర్వాలేదు.",
  'mr-IN': "नमस्कार! मी Pharmaco चा सहाय्यक आहे. तुम्हाला काय झालं ते मोकळेपणाने सांगा — जितके सांगायचे तितके.",
  'bn-IN': "নমস্কার! আমি Pharmaco-এর সহায়ক। কী হয়েছে তা নিঃসংকোচে বলুন — যতটুকু চান।",
  'gu-IN': "નમસ્કાર! હું Pharmaco નો સહાયક છું. શું થયું તે નિઃસંકોચ જણાવો — જેટલું કહેવું હોય તેટલું.",
  'ml-IN': "നമസ്‌കാരം! ഞാൻ Pharmaco-യുടെ സഹായകനാണ്. എന്ത് സംഭവിച്ചു എന്ന് നിർഭയമായി പറയൂ — ആവശ്യമുള്ളത്ര.",
};

export const LANGUAGE_CODES = {
  English: 'en-IN',
  Hindi: 'hi-IN',
  Kannada: 'kn-IN',
  Tamil: 'ta-IN',
  Telugu: 'te-IN',
  Marathi: 'mr-IN',
  Bengali: 'bn-IN',
  Gujarati: 'gu-IN',
  Malayalam: 'ml-IN',
};

export const LANGUAGE_NAMES = Object.fromEntries(
  Object.entries(LANGUAGE_CODES).map(([name, code]) => [code, name])
);
