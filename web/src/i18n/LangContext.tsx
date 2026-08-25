import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';
import { uiStrings } from './strings';
import type { Lang } from '../types';

interface LangContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
}

const LangContext = createContext<LangContextType>(null!);

export function LangProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [lang, setLang] = useState<Lang>(() => {
    const saved = localStorage.getItem('bloodtests_lang');
    return (saved as Lang) || 'en';
  });

  const changeLang = useCallback((newLang: Lang) => {
    setLang(newLang);
    localStorage.setItem('bloodtests_lang', newLang);
  }, []);

  const t = useCallback((key: string): string => {
    return uiStrings[lang]?.[key] || uiStrings['en']?.[key] || key;
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang: changeLang, t }), [lang, changeLang, t]);

  return (
    <LangContext.Provider value={value}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
