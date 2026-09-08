import { useState } from 'react';
import { useLang } from '../../i18n/LangContext';
import { useData } from '../../data/DataContext';
import { getAnalysisName } from '../../utils/analysis';
import { formatFrequencyText } from '../../utils/format';
import type { Analysis, PanelViewMode } from '../../types';

const academicHatIcon = `<svg class="detail-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#60a5fa" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5L12 4l9 4.5L12 13 3 8.5z"/><path d="M7 10.4v3.7c0 1.5 2.3 3 5 3s5-1.5 5-3v-3.7"/><path d="M20 9v4.6"/></svg>`;
const clipboardIcon = `<svg class="detail-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#60a5fa" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9z"/><path d="M8 11.5h8"/><path d="M8 16h8"/></svg>`;
const clockIcon = `<svg class="detail-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#60a5fa" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5"/><path d="M12 12l3.5 3"/></svg>`;

interface Props {
  analysis: Analysis;
  viewMode: PanelViewMode;
}

export function AnalysisItem({ analysis, viewMode }: Props) {
  const { lang, t } = useLang();
  const { analysesCatalog } = useData();
  const [scientificExpanded, setScientificExpanded] = useState(false);
  const name = getAnalysisName(analysis.loinc, analysesCatalog, lang);

  if (viewMode === 'minimal') {
    return <li>{name}</li>;
  }

  if (viewMode === 'compact') {
    return (
      <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontWeight: 400 }}>{name}</span>
        <span className="result-loinc">{analysis.loinc}</span>
      </li>
    );
  }

  // Detailed mode
  const inf = (lang !== 'en' && analysis.info?.lang?.[lang])
    ? { ...analysis.info, ...analysis.info.lang[lang] }
    : analysis.info;

  const translatedName = name;
  const engPrefix = (lang !== 'en' && !translatedName.includes(analysis.displayName))
    ? analysis.displayName + ', '
    : '';

  return (
    <>
      <li className="analysis-name">
        <div>{name}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
          <span className="result-loinc" style={{ fontWeight: 'normal', fontStyle: 'italic' }}>
            {engPrefix}{analysis.longCommonName}
          </span>
          <a
            href={`https://loinc.org/${encodeURIComponent(analysis.loinc)}`}
            target="_blank"
            rel="noopener"
            className="loinc-link result-loinc"
            style={{ fontWeight: 'normal', whiteSpace: 'nowrap' }}
          >
            {analysis.loinc}
          </a>
        </div>
      </li>
      {inf?.description && (
        <li className="detail-line description">{inf.description}</li>
      )}
      {inf?.scientific && (
        <li
          className={`detail-line scientific${scientificExpanded ? ' expanded' : ''}`}
          onClick={() => setScientificExpanded(!scientificExpanded)}
        >
          <span dangerouslySetInnerHTML={{ __html: academicHatIcon }} />
          {inf.scientific}
        </li>
      )}
      {inf?.why && (
        <li className="detail-line why-line">
          <span dangerouslySetInnerHTML={{ __html: clipboardIcon }} />
          {inf.why}
        </li>
      )}
      {inf?.frequency && (
        <li className="detail-line freq-line">
          <span dangerouslySetInnerHTML={{ __html: clockIcon }} />
          {t('frequencyPrefix')} {formatFrequencyText(inf.frequency)}
        </li>
      )}
    </>
  );
}
