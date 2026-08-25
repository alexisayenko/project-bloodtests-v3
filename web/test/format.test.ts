import { describe, it, expect } from 'vitest';
import {
  fmtNum,
  formatDate,
  formatFrequencyText,
  formatResultReference,
  formatResultValue,
  isNearOutOfRange,
  isOutOfRange,
} from '../src/utils/format';
import type { Result } from '../src/types';

const result = (partial: Partial<Result>): Result => ({
  loinc: '',
  analysis: '',
  symbol: '',
  section: '',
  value: null,
  rawValue: '',
  valueQualifier: '',
  unit: '',
  refText: '',
  refMin: null,
  refMax: null,
  method: '',
  ...partial,
});

describe('fmtNum — adaptive precision by magnitude (v2 parity)', () => {
  it('scales decimals down as the value grows', () => {
    expect(fmtNum(0.4475)).toBe('0.448');
    expect(fmtNum(1.874669)).toBe('1.87');
    expect(fmtNum(28.571429)).toBe('28.6');
    expect(fmtNum(150)).toBe('150');
  });

  it('renders null/undefined as empty (callers supply their own dash)', () => {
    expect(fmtNum(null)).toBe('');
    expect(fmtNum(undefined)).toBe('');
  });
});

describe('formatDate', () => {
  it('renders "YYYY Mon" in English', () => {
    expect(formatDate('2026-08-25')).toBe('2026 Aug');
  });
});

describe('formatResultValue / formatResultReference', () => {
  it('prefers the lab-printed rawValue', () => {
    expect(formatResultValue(result({ rawValue: '<0.1', value: 0.1 }))).toBe('<0.1');
  });

  it('reference shows a range, a bound, or a dash', () => {
    expect(formatResultReference(result({ refMin: 13, refMax: 17 }))).toBe('13 – 17');
    expect(formatResultReference(result({ refMin: 13 }))).toBe('> 13');
    expect(formatResultReference(result({ refMax: 17 }))).toBe('< 17');
    expect(formatResultReference(result({}))).toBe('—');
  });
});

describe('formatFrequencyText', () => {
  it('joins semicolon-separated fragments and lowercases the first letter', () => {
    expect(formatFrequencyText('Yearly; twice if abnormal')).toBe('yearly, twice if abnormal');
    expect(formatFrequencyText('')).toBe('');
  });
});

describe('isOutOfRange / isNearOutOfRange', () => {
  it('flags values outside the reference bounds', () => {
    expect(isOutOfRange(result({ value: 12, refMin: 13, refMax: 17 }))).toBe(true);
    expect(isOutOfRange(result({ value: 18, refMin: 13, refMax: 17 }))).toBe(true);
    expect(isOutOfRange(result({ value: 15, refMin: 13, refMax: 17 }))).toBe(false);
  });

  it('never flags without a value or without any bound', () => {
    expect(isOutOfRange(result({ refMin: 13 }))).toBe(false);
    expect(isOutOfRange(result({ value: 15 }))).toBe(false);
  });

  it('near-out-of-range needs both bounds and flags the margins', () => {
    expect(isNearOutOfRange(result({ value: 13.1, refMin: 13, refMax: 17 }))).toBe(true);
    expect(isNearOutOfRange(result({ value: 15, refMin: 13, refMax: 17 }))).toBe(false);
    expect(isNearOutOfRange(result({ value: 13.1, refMin: 13 }))).toBe(false);
  });
});
