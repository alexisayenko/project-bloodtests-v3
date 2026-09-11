import { useMemo, useState } from 'react';
import type { Result } from '../../types';
import { useData } from '../../data/DataContext';
import { crossCheckLocal, latinPart, type CrossCheckResult } from '../../data/loincCheck';
import { fetchNlmLoinc, type NlmEntry } from '../../data/loincNlm';
import {
  applyFixes,
  buildExpandedCatalog,
  buildNlmSuggestionsByRow,
  computeConfidentFixes,
  isRowUnresolved,
} from './reportDetailHelpers';

export interface LoincCrossCheck {
  checkResults: CrossCheckResult[] | null;
  nlmState: 'idle' | 'loading' | 'done' | 'failed';
  nlmByCode: Record<string, string | null>;
  nlmSuggestions: Record<number, NlmEntry[]>;
  autoFilledCount: number;
  unresolvedRows: { r: CrossCheckResult; i: number }[];
  onCrossCheck: () => void;
  onNlmCheck: () => Promise<void>;
}

export function useLoincCrossCheck(
  items: Result[] | null | undefined,
  setDraftItems: (items: Result[]) => void
): LoincCrossCheck {
  const { analysesCatalog } = useData();
  const [checkResults, setCheckResults] = useState<CrossCheckResult[] | null>(null);
  const [nlmState, setNlmState] = useState<'idle' | 'loading' | 'done' | 'failed'>('idle');
  const [nlmByCode, setNlmByCode] = useState<Record<string, string | null>>({});
  const [nlmSuggestions, setNlmSuggestions] = useState<Record<number, NlmEntry[]>>({});
  const [autoFilledCount, setAutoFilledCount] = useState(0);

  const expandedCatalog = useMemo(() => buildExpandedCatalog(analysesCatalog), [analysesCatalog]);

  const onCrossCheck = () => {
    if (!items) return;
    const results = crossCheckLocal(items, expandedCatalog);
    const fixes = computeConfidentFixes(items, results);
    if (fixes.size > 0) {
      const updated = applyFixes(items, fixes);
      setDraftItems(updated);
      setCheckResults(crossCheckLocal(updated, expandedCatalog));
      setAutoFilledCount(fixes.size);
    } else {
      setCheckResults(results);
      setAutoFilledCount(0);
    }
    setNlmState('idle');
    setNlmByCode({});
    setNlmSuggestions({});
  };

  // Rows the local pass couldn't resolve: unknown codes, or codeless rows
  // with no local suggestion.
  const unresolvedRows = useMemo(() => {
    if (!checkResults || !items) return [];
    return checkResults
      .map((r, i) => ({ r, i }))
      .filter(({ r, i }) => isRowUnresolved(r, i, items, nlmByCode, nlmSuggestions));
  }, [checkResults, items, nlmByCode, nlmSuggestions]);

  const onNlmCheck = async () => {
    if (!items || !checkResults) return;
    setNlmState('loading');
    const codes = unresolvedRows.filter(({ r }) => r.status === 'unknown-code').map(({ i }) => items[i]!.loinc);
    const names = unresolvedRows
      .filter(({ r }) => r.status === 'no-code')
      .map(({ i }) => latinPart(items[i]!.rawName))
      .filter((n) => n !== '');
    const result = await fetchNlmLoinc([...new Set(codes)], [...new Set(names)]);
    setNlmByCode(result.byCode);
    setNlmSuggestions(buildNlmSuggestionsByRow(unresolvedRows, items, result.byName));
    setNlmState(result.status === 'ok' ? 'done' : 'failed');
  };

  return {
    checkResults,
    nlmState,
    nlmByCode,
    nlmSuggestions,
    autoFilledCount,
    unresolvedRows,
    onCrossCheck,
    onNlmCheck,
  };
}
