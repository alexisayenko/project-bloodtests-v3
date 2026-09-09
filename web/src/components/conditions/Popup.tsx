import type { ReactNode } from 'react';
import { fmtNum, formatResultReference, isOutOfRange } from '../../utils/format';
import { computeIndex, zone, type IndexDef } from '../../data/computedIndices';
import type { Result } from '../../types';
import { isEchoRedundant, testLoincs, type Observation } from './markers';
import { ZONE_BG, formatMonthYear, greenRangeOf, pressable, cellBg } from './ui';
import { getLatest, hasReference, type LatestByLoinc, type ResultEntry } from './resultsLookup';
import { COLOR } from '../../styles/tokens';

export type PopupPosition = { left: number; width: number; top?: number; bottom?: number };
export type PopupState =
  | ({ kind: 'observation'; test: Observation } & PopupPosition)
  | ({ kind: 'index'; def: IndexDef } & PopupPosition)
  | ({ kind: 'result'; test: Observation; entry: ResultEntry } & PopupPosition)
  | ({ kind: 'indexResult'; def: IndexDef; date: string; value: number } & PopupPosition);

function LatestValue({ latestByLoinc, loincs }: Readonly<{ latestByLoinc: LatestByLoinc; loincs: string[] }>) {
  const current = getLatest(latestByLoinc, loincs);
  if (!current) {
    return (
      <div style={{ fontSize: 13, color: COLOR.textMuted, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${COLOR.borderSubtle}` }}>
        Never taken
      </div>
    );
  }
  const value = current.result.rawValue || fmtNum(current.result.value);
  const bg = cellBg(hasReference(current.result), isOutOfRange(current.result), false);
  return (
    <div style={{ fontSize: 13, color: COLOR.textSecondary, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${COLOR.borderSubtle}` }}>
      <div style={{ fontWeight: 500, color: COLOR.text }}>Latest taken on {formatMonthYear(current.date)}</div>
      <div style={{ marginTop: 4, padding: '4px 8px', borderRadius: 6, background: bg }}>
        {value} {current.result.unit}
        <span style={{ color: COLOR.textMuted }}> (Ref: {formatResultReference(current.result)})</span>
      </div>
    </div>
  );
}

function LoincChip({ loinc, unit }: Readonly<{ loinc: string; unit?: string }>) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4 }}>
      <a href={`https://loinc.org/${loinc}`} target="_blank" rel="noreferrer" style={{ fontFamily: 'monospace', color: COLOR.accent }}>
        {loinc}
      </a>
      {unit && <span style={{ color: COLOR.textMuted }}>{unit}</span>}
    </span>
  );
}

function ObservationPopupBody({ test, latestByLoinc }: Readonly<{ test: Observation; latestByLoinc: LatestByLoinc }>) {
  return (
    <>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
        {test.full}
        {!isEchoRedundant(test.full, test.short) && ` (${test.short})`}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', fontSize: 13, color: COLOR.textSecondary }}>
        <LoincChip loinc={test.loinc} unit={test.unit} />
        {test.also?.map((ref) => (
          <LoincChip key={ref.loinc} loinc={ref.loinc} unit={ref.unit} />
        ))}
      </div>
      <LatestValue latestByLoinc={latestByLoinc} loincs={testLoincs(test)} />
    </>
  );
}

function ResultPopupBody({ test, entry }: Readonly<{ test: Observation; entry: ResultEntry }>) {
  const value = entry.result.rawValue || fmtNum(entry.result.value);
  const bg = cellBg(hasReference(entry.result), isOutOfRange(entry.result), false);
  return (
    <>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
        {test.full}
        {!isEchoRedundant(test.full, test.short) && ` (${test.short})`}
      </div>
      <div style={{ fontSize: 13, color: COLOR.textSecondary }}>
        {formatMonthYear(entry.date)} · {entry.place}
      </div>
      <div style={{ marginTop: 8, padding: '4px 8px', borderRadius: 6, background: bg, fontSize: 13, color: COLOR.textSecondary }}>
        {value} {entry.result.unit}
        <span style={{ color: COLOR.textMuted }}> (Ref: {formatResultReference(entry.result)})</span>
      </div>
    </>
  );
}

function IndexResultPopupBody({
  def,
  date,
  value,
  resultsByDate,
}: Readonly<{ def: IndexDef; date: string; value: number; resultsByDate: Record<string, Record<string, Result>> }>) {
  const z = zone(value, def.cut[0], def.cut[1], def.hi);
  // Same date as the calculated value -- more precise than IndexPopupBody's
  // "latest lab-reported" fallback, since here we already know which draw.
  const reported = def.loinc ? resultsByDate[date]?.[def.loinc] : undefined;
  return (
    <>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
        {def.name}
        {!isEchoRedundant(def.name, def.nameCompact) && ` (${def.nameCompact})`}
      </div>
      <div style={{ fontSize: 13, color: COLOR.textSecondary }}>
        {formatMonthYear(date)} · Calculated
      </div>
      <div style={{ marginTop: 8, padding: '4px 8px', borderRadius: 6, background: ZONE_BG[z], fontSize: 13, color: COLOR.textSecondary }}>
        {fmtNum(value)} {def.unit ?? ''}
        <span style={{ color: COLOR.textMuted }}> (Ref: {greenRangeOf(def)})</span>
      </div>
      {reported && (
        <div style={{ fontSize: 13, color: COLOR.textSecondary, marginTop: 8 }}>
          <div style={{ fontWeight: 500, color: COLOR.text }}>Lab reported, same draw</div>
          <div style={{ marginTop: 4, padding: '4px 8px', borderRadius: 6, background: COLOR.surfaceMuted }}>
            {reported.rawValue || fmtNum(reported.value)} {reported.unit}
          </div>
        </div>
      )}
    </>
  );
}

function IndexPopupBody({
  def,
  latestByLoinc,
  resultsByDate,
  onLearnMore,
}: Readonly<{
  def: IndexDef;
  latestByLoinc: LatestByLoinc;
  resultsByDate: Record<string, Record<string, Result>>;
  onLearnMore: (key: string) => void;
}>) {
  const dates = Object.keys(resultsByDate).sort((a, b) => b.localeCompare(a));
  let latest: { value: number; date: string } | null = null;
  for (const date of dates) {
    const value = computeIndex(def, resultsByDate[date]!);
    if (value != null) {
      latest = { value, date };
      break;
    }
  }
  const reported = def.loinc ? latestByLoinc[def.loinc] : undefined;
  return (
    <>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
        {def.name}
        {!isEchoRedundant(def.name, def.nameCompact) && ` (${def.nameCompact})`}
      </div>
      <div style={{ fontSize: 12, color: COLOR.textMuted, fontFamily: 'monospace', whiteSpace: 'pre-line', marginBottom: 10 }}>{def.formula}</div>
      <div style={{ fontSize: 13, color: COLOR.textSecondary, paddingTop: 8, borderTop: `1px solid ${COLOR.borderSubtle}` }}>
        {latest ? (
          <>
            <div style={{ fontWeight: 500, color: COLOR.text }}>Calculated, {formatMonthYear(latest.date)}</div>
            <div
              style={{
                marginTop: 4,
                padding: '4px 8px',
                borderRadius: 6,
                background: ZONE_BG[zone(latest.value, def.cut[0], def.cut[1], def.hi)],
              }}
            >
              {fmtNum(latest.value)} {def.unit ?? ''}
              <span style={{ color: COLOR.textMuted }}> (Ref: {greenRangeOf(def)})</span>
            </div>
          </>
        ) : (
          'Not enough data to calculate yet'
        )}
      </div>
      {reported && (
        <div style={{ fontSize: 13, color: COLOR.textSecondary, marginTop: 8 }}>
          <div style={{ fontWeight: 500, color: COLOR.text }}>Lab reported, {formatMonthYear(reported.date)}</div>
          <div style={{ marginTop: 4, padding: '4px 8px', borderRadius: 6, background: COLOR.surfaceMuted }}>
            {reported.result.rawValue || fmtNum(reported.result.value)} {reported.result.unit}
          </div>
        </div>
      )}
      <div style={{ fontSize: 13, color: COLOR.text, marginTop: 10 }}>{def.meaning}</div>
      <div style={{ fontSize: 12, color: COLOR.textSecondary, marginTop: 10 }}>
        <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{def.evidenceLevel}</span>
        {def.references[0] && ` -- ${def.references[0].organization}`}
      </div>
      <div
        {...pressable(() => onLearnMore(def.key))}
        style={{ fontSize: 13, color: COLOR.accent, fontWeight: 500, marginTop: 10, cursor: 'pointer' }}
      >
        Learn more →
      </div>
    </>
  );
}

export function Popup({
  popup,
  latestByLoinc,
  resultsByDate,
  onClose,
  onLearnMore,
}: Readonly<{
  popup: PopupState | null;
  latestByLoinc: LatestByLoinc;
  resultsByDate: Record<string, Record<string, Result>>;
  onClose: () => void;
  onLearnMore: (key: string) => void;
}>) {
  if (!popup) return null;

  let body: ReactNode;
  if (popup.kind === 'observation') {
    body = <ObservationPopupBody test={popup.test} latestByLoinc={latestByLoinc} />;
  } else if (popup.kind === 'index') {
    body = <IndexPopupBody def={popup.def} latestByLoinc={latestByLoinc} resultsByDate={resultsByDate} onLearnMore={onLearnMore} />;
  } else if (popup.kind === 'result') {
    body = <ResultPopupBody test={popup.test} entry={popup.entry} />;
  } else {
    body = <IndexResultPopupBody def={popup.def} date={popup.date} value={popup.value} resultsByDate={resultsByDate} />;
  }

  return (
    <>
      <div aria-label="Close popup" {...pressable(onClose)} style={{ position: 'fixed', inset: 0, zIndex: 100 }} />
      <div
        style={{
          position: 'fixed',
          top: popup.top,
          bottom: popup.bottom,
          left: popup.left,
          background: COLOR.surface,
          border: `1.5px solid ${COLOR.accent}`,
          borderRadius: 12,
          padding: 18,
          // Already capped to the viewport by popupPosition, which sized the box
          // it placed -- rendering the untrimmed constant here would put the
          // right edge back off a narrow screen.
          width: popup.width,
          // Cap to whatever room is actually left on the anchored side, not just
          // the viewport height -- otherwise a popup opened partway down the
          // page can still try to render taller than the space below it.
          maxHeight: popup.top != null ? `calc(100vh - ${popup.top}px - 8px)` : `calc(100vh - ${popup.bottom}px - 8px)`,
          overflowY: 'auto',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
          boxSizing: 'border-box',
          zIndex: 101,
        }}
      >
        {body}
      </div>
    </>
  );
}
