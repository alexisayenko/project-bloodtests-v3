import { useLang } from '../../i18n/LangContext';
import { useData } from '../../data/DataContext';
import { getResultDisplayName } from '../../utils/analysis';
import { formatResultValue, formatResultReference, isOutOfRange, isNearOutOfRange } from '../../utils/format';
import type { Result } from '../../types';

interface Props {
  result: Result;
  panelColor?: string;
}

export function ResultRow({ result, panelColor }: Props) {
  const { lang } = useLang();
  const { analysesCatalog } = useData();
  const oor = isOutOfRange(result);
  const near = isNearOutOfRange(result);

  const classNames = [
    'results-row',
    oor ? 'out-of-range' : near ? 'near-out-of-range' : '',
    panelColor ? 'panel-colored' : '',
  ].filter(Boolean).join(' ');

  const style = panelColor ? { '--row-panel-color': panelColor } as React.CSSProperties : undefined;

  return (
    <div className={classNames} style={style}>
      <span className="result-name">
        {getResultDisplayName(result, analysesCatalog, lang)}
        <br />
        <span className="result-loinc">
          {result.loinc ? (
            <a
              href={`https://loinc.org/${encodeURIComponent(result.loinc)}`}
              target="_blank"
              rel="noopener"
              className="loinc-link"
            >
              LOINC {result.loinc}
            </a>
          ) : 'Unmapped'}
          {result.method && ` · ${result.method}`}
          {result.symbol && ` · ${result.symbol}`}
        </span>
      </span>
      <span className="result-value">{formatResultValue(result)}</span>
      <span className="result-ref">{formatResultReference(result)}</span>
    </div>
  );
}
