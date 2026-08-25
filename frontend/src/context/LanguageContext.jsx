import { createContext, useContext, useState, useEffect } from 'react';
import { LANGUAGES } from '../utils/i18n.js';

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    return localStorage.getItem('pharmaco_language') || 'hi-IN';
  });

  const setLanguage = (code) => {
    setLanguageState(code);
    localStorage.setItem('pharmaco_language', code);
  };

  const currentLang = LANGUAGES.find((l) => l.code === language) || LANGUAGES[0];

  return (
    <LanguageContext.Provider value={{ language, setLanguage, currentLang, LANGUAGES }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguageContext = () => useContext(LanguageContext);
