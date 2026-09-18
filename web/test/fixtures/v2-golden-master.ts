import type { Result } from '../../src/types';
import { makeResult } from '../helpers/fixtures';

/**
 * Golden-master for all derived indices, ported from
 * project-bloodtests-v2 engine/test/indices.test.ts. Expected values are the
 * v2 GOLD constants, re-baselined where noted on GOLD below; v3 drops the
 * age/sex indices (eGFR ×3, FIB-4), so those golds are omitted.
 *
 * Unlike v2's test (which normalized units by hand before calling fn), this
 * fixture is Result objects with real LOINCs and units, so the assertion
 * exercises v3's own pipeline: findResult's LOINC candidates → toUnit
 * normalization → fn. Testosterone is deliberately given in nmol/L (the molar
 * LOINC 14913-8) to prove the nmol/L → ng/dL conversion feeds the formulas.
 */

export function r(loinc: string, value: number, unit: string): [string, Result] {
  return [loinc, makeResult({ loinc, value, unit })];
}

// Alex's fixture from v2, US units — except T, stored molar as labs report it.
export const RESULTS: Record<string, Result> = Object.fromEntries([
  r('2093-3', 200, 'mg/dL'), // TC
  r('2085-9', 50, 'mg/dL'), // HDL-C
  r('13457-7', 120, 'mg/dL'), // LDL-C
  r('2571-8', 150, 'mg/dL'), // TRIG
  r('1884-6', 90, 'mg/dL'), // ApoB
  r('1869-7', 130, 'mg/dL'), // ApoA1
  r('2339-0', 95, 'mg/dL'), // GLU
  r('20448-7', 8, 'uIU/mL'), // Insulin
  r('14913-8', 17.335, 'nmol/L'), // T — 500 ng/dL, molar
  r('2991-8', 90, 'pg/mL'), // Free T, measured
  r('2942-1', 40, 'nmol/L'), // SHBG
  r('1751-7', 4.3, 'g/dL'), // ALB
  r('10501-5', 5, 'mIU/mL'), // LH
  r('2243-4', 30, 'pg/mL'), // E2
  r('1848-1', 400, 'pg/mL'), // DHT
  r('2143-6', 15, 'mcg/dL'), // Cortisol
  r('2191-5', 250, 'mcg/dL'), // DHEA-S
  r('3051-0', 3.1, 'pg/mL'), // FT3
  r('3024-7', 1.3, 'ng/dL'), // FT4
  r('1920-8', 25, 'U/L'), // AST
  r('1742-6', 20, 'U/L'), // ALT
  r('2498-4', 100, 'mcg/dL'), // Fe
  r('2500-7', 350, 'mcg/dL'), // TIBC
]);

// v2 GOLD, minus the unported age/sex indices (egfr, egfrcys, egfrcrcys, fib4).
//
// Re-baselined off v2 when the mass<->molar conversion constants stopped being
// hand-typed and became derived from cited molar masses (molar-masses.json):
// several hand-typed constants were slightly imprecise. The shift is <=0.07%
// relative and moves no value the UI displays at 2dp — a constants correction,
// not a change in any formula.
export const GOLD: Record<string, number> = {
  ka: 3,
  tchdl: 4,
  ldlhdl: 2.4,
  aip: 0.117289,
  nonhdl: 150,
  remnant: 30,
  vldl: 30,
  ldlf: 120,
  ldls: 123.397291,
  ldlmh: 123.684211,
  apobapoa: 0.692308,
  tyg: 8.871365,
  gi: 11.875,
  homair: 1.874918,
  homab: 90.231958,
  cft: 93.162473,
  cftpct: 1.863268,
  ftpct: 1.800018,
  cftlh: 77.989086,
  cftlhpct: 1.559797,
  biot: 7.569375,
  biotpct: 43.66527,
  fai: 43.3375,
  tlh: 99.999028,
  te2: 16.666505,
  dhtt: 8.000078,
  cortdhea: 0.060995,
  ft3ft4: 0.284579,
  deritis: 1.25,
  tsat: 28.571429,
};
