import { useEffect, useMemo, useRef, useState } from 'react';
import { useLang } from '../../i18n/LangContext';
import { useData } from '../../data/DataContext';
import { getAnalysisName } from '../../utils/analysis';
import {
  initStackedChart3D,
  parseObservationDate,
  type OpacityMode,
  type StackedChart3DHandle,
  type StackedSeriesInput,
} from './chart3d-stacked-core';
import type { LoincEntry } from './types';
import { PALETTE } from './palette';

export interface StackedEntry extends LoincEntry {
  colorIndex: number;
}

interface Props {
  entries: StackedEntry[];
  nameFor?: (loinc: string) => string | undefined;
}

/** "Compare in 3D" view: stacked-ribbon 3D chart, one depth plane per selected biomarker. */
export function StackedBiomarkerChart3D({ entries, nameFor }: Readonly<Props>) {
  const { lang } = useLang();
  const { analysesCatalog } = useData();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const handleRef = useRef<StackedChart3DHandle | null>(null);
  const [opacityMode, setOpacityMode] = useState<OpacityMode>('translucent');
  const [fromYear, setFromYear] = useState<number | null>(null);
  const [toYear, setToYear] = useState<number | null>(null);
  const initialOpacityMode = useRef(opacityMode);

  // The canvas element itself is always mounted (see the empty-state overlay
  // below, rendered alongside rather than instead of it) so this effect's
  // empty dependency array is safe -- the engine is created exactly once per
  // mount and torn down on unmount; series/opacity/window changes flow
  // through the handle's own setters, not through re-running this effect.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handle = initStackedChart3D(canvas, { opacityMode: initialOpacityMode.current });
    handleRef.current = handle;
    return () => {
      handle.destroy();
      handleRef.current = null;
    };
  }, []);

  useEffect(() => {
    handleRef.current?.setOpacityMode(opacityMode);
  }, [opacityMode]);

  const series = useMemo<StackedSeriesInput[]>(() => entries.map((entry) => ({
    id: entry.loinc,
    label: nameFor?.(entry.loinc) ?? getAnalysisName(entry.loinc, analysesCatalog, lang),
    color: PALETTE[entry.colorIndex],
    points: entry.results
      .filter((r) => r.result.value != null && Number.isFinite(r.result.value))
      .map((r) => ({ t: parseObservationDate(r.date), value: r.result.value as number }))
      .filter((p) => Number.isFinite(p.t)),
  })), [entries, nameFor, analysesCatalog, lang]);

  useEffect(() => {
    handleRef.current?.update(series);
  }, [series]);

  // Only the years the data actually has -- a gap year stays absent from the
  // list rather than being filled in.
  const years = useMemo(() => {
    const seen = new Set<number>();
    for (const s of series) for (const p of s.points) seen.add(new Date(p.t).getFullYear());
    return [...seen].sort((a, b) => a - b);
  }, [series]);

  const first = years[0] ?? null;
  const last = years.at(-1) ?? null;
  const activeFrom = fromYear != null && years.includes(fromYear) ? fromYear : first;
  const activeTo = toYear != null && years.includes(toYear) ? toYear : last;

  useEffect(() => {
    if (activeFrom == null || activeTo == null) return;
    handleRef.current?.setRange(
      new Date(activeFrom, 0, 1).getTime(),
      new Date(activeTo, 11, 31, 23, 59, 59, 999).getTime(),
    );
  }, [activeFrom, activeTo, series]);

  const pickFrom = (year: number) => {
    setFromYear(year);
    if (activeTo != null && year > activeTo) setToYear(year);
  };

  const pickTo = (year: number) => {
    setToYear(year);
    if (activeFrom != null && year < activeFrom) setFromYear(year);
  };

  const resetView = () => {
    handleRef.current?.resetView();
    setFromYear(null);
    setToYear(null);
  };

  return (
    <div className="stacked-chart-3d">
      <div className="stacked-chart-3d-controls">
        <button
          type="button"
          className="stacked-chart-3d-btn"
          aria-pressed={opacityMode === 'translucent'}
          onClick={() => setOpacityMode((m) => (m === 'translucent' ? 'opaque' : 'translucent'))}
        >
          Translucent
        </button>
        <button
          type="button"
          className="stacked-chart-3d-btn"
          onClick={resetView}
        >
          Reset view
        </button>
        <select
          className="stacked-chart-3d-select"
          aria-label="From year"
          value={activeFrom ?? ''}
          disabled={years.length === 0}
          onChange={(e) => pickFrom(Number(e.target.value))}
        >
          {years.map((year) => <option key={year} value={year}>{year}</option>)}
        </select>
        <select
          className="stacked-chart-3d-select"
          aria-label="To year"
          value={activeTo ?? ''}
          disabled={years.length === 0}
          onChange={(e) => pickTo(Number(e.target.value))}
        >
          {years.map((year) => <option key={year} value={year}>{year}</option>)}
        </select>
      </div>
      <div className="stacked-chart-3d-canvas-wrap">
        <canvas ref={canvasRef} className="stacked-chart-3d-canvas" />
        {entries.length === 0 && (
          <div className="stacked-chart-3d-empty">Pick at least one biomarker below to compare.</div>
        )}
      </div>
    </div>
  );
}
