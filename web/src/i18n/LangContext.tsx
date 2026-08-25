import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { uiStrings } from './strings';
import type { Lang } from '../types';

interface LangContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
}

const LangContext = createContext<LangContextType>(null!);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem('bloodtests_lang');
    return (saved as Lang) || 'en';
  });

  const setLang = useCallback((newLang: Lang) => {
    setLangState(newLang);
    localStorage.setItem('bloodtests_lang', newLang);
  }, []);

  const t = useCallback((key: string): string => {
    return uiStrings[lang]?.[key] || uiStrings['en']?.[key] || key;
  }, [lang]);

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
