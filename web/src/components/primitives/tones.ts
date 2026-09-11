import { COLOR } from '../../styles/tokens';

/** ok/warn/bad match `computedIndices.ts`'s `Zone`, so a zone is a tone as it stands. */
export type StatusTone = 'ok' | 'warn' | 'bad' | 'none';

export const TONE_DOT: Record<StatusTone, string> = {
  ok: COLOR.statusOk,
  warn: COLOR.statusWarn,
  bad: COLOR.statusBad,
  none: COLOR.statusNone,
};

export const TONE_LABEL: Record<StatusTone, string> = {
  ok: 'In range',
  warn: 'Borderline',
  bad: 'Out of range',
  none: 'Not tested',
};
