import { useLang } from '../../i18n/LangContext';
import { useResultsContext } from '../../data/ResultsContext';
import type { Lang } from '../../types';

const languages: { value: Lang; label: string }[] = [
  { value: 'en', label: 'EN' },
  { value: 'ru-RU', label: 'RU' },
  { value: 'uk-UA', label: 'UA' },
];

export function Header() {
  const { lang, setLang, t } = useLang();
  const { hasData, clearData } = useResultsContext();

  return (
    <header className="header">
      <h1>{t('uploadTitle')}</h1>
      <div className="header-controls">
        <div className="lang-group">
          {languages.map(l => (
            <button
              key={l.value}
              className={`lang-btn${lang === l.value ? ' active' : ''}`}
              onClick={() => setLang(l.value)}
            >
              {l.label}
            </button>
          ))}
        </div>
        {hasData && (
          <button className="btn-header" onClick={clearData}>{t('changeFile')}</button>
        )}
      </div>
    </header>
  );
}
