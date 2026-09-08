import { massPerMolarUnit, molarMassOf } from './molarMasses';

// Curated mass↔molar LOINC sibling pairs: the same analyte measured on a
// [Mass/volume] scale and on a [Moles/volume] scale, which LOINC gives two
// different codes. Long common names are as published by LOINC (verified
// against the NLM Clinical Tables loinc_items API).
//
// A pair names its analyte's entry in the molar-mass reference data
// (`molarMass`) and never states a factor: `massPerMolarUnit` and
// `molarMassGPerMol` below are DERIVED from that entry and the pair's own two
// units, so the table cannot drift from the sources in
// `web/public/data/molar-masses.json`. Several pairs share one entry — total,
// HDL and LDL cholesterol are all cholesterol.
//
// The factor converts a value in `molar.unit` to `mass.unit`. It is never
// applied to a stored or exported value: a molar unit under a mass code is a
// CODE problem, and the remedy is the sibling code, never a rewritten number
// (ADR-0003). Its one use is display-time normalization — the "What's in
// range" chart places a history that crosses the mass/molar divide onto the
// one scale its reference band is expressed in (exploreModel.ts).

export interface SiblingCode {
  loinc: string;
  longCommonName: string;
  unit: string;
}

interface MassMolarSiblingDef {
  analyte: string;
  /** Key into MOLAR_MASS_BY_ID — where this pair's molar mass and its sources live. */
  molarMass: string;
  mass: SiblingCode;
  molar: SiblingCode;
  note?: string;
}

export interface MassMolarSibling extends MassMolarSiblingDef {
  /** Derived: how much of `mass.unit` one unit of `molar.unit` is. */
  massPerMolarUnit: number;
  /** Derived: the tabulated molar mass, restated here for readers of a pair. */
  molarMassGPerMol: number;
}

const PAIRS: MassMolarSiblingDef[] = [
  {
    analyte: 'Cholesterol (total)',
    molarMass: 'cholesterol',
    mass: { loinc: '2093-3', longCommonName: 'Cholesterol [Mass/volume] in Serum or Plasma', unit: 'mg/dL' },
    molar: { loinc: '14647-2', longCommonName: 'Cholesterol [Moles/volume] in Serum or Plasma', unit: 'mmol/L' },
  },
  {
    analyte: 'Cholesterol in HDL',
    molarMass: 'cholesterol',
    mass: { loinc: '2085-9', longCommonName: 'Cholesterol in HDL [Mass/volume] in Serum or Plasma', unit: 'mg/dL' },
    molar: { loinc: '14646-4', longCommonName: 'Cholesterol in HDL [Moles/volume] in Serum or Plasma', unit: 'mmol/L' },
  },
  {
    analyte: 'Cholesterol in LDL',
    molarMass: 'cholesterol',
    mass: {
      loinc: '13457-7',
      longCommonName: 'Cholesterol in LDL [Mass/volume] in Serum or Plasma by calculation',
      unit: 'mg/dL',
    },
    molar: { loinc: '22748-8', longCommonName: 'Cholesterol in LDL [Moles/volume] in Serum or Plasma', unit: 'mmol/L' },
    note: 'The mass code is method-specific (by calculation); the molar code is not.',
  },
  {
    analyte: 'Cholesterol in VLDL',
    molarMass: 'cholesterol',
    mass: {
      loinc: '13458-5',
      longCommonName: 'Cholesterol in VLDL [Mass/volume] in Serum or Plasma by calculation',
      unit: 'mg/dL',
    },
    molar: { loinc: '25371-6', longCommonName: 'Cholesterol in VLDL [Moles/volume] in Serum or Plasma', unit: 'mmol/L' },
    note: 'The mass code is method-specific (by calculation); the molar code is not.',
  },
  {
    analyte: 'Triglyceride',
    molarMass: 'triglyceride',
    mass: { loinc: '2571-8', longCommonName: 'Triglyceride [Mass/volume] in Serum or Plasma', unit: 'mg/dL' },
    molar: { loinc: '14927-8', longCommonName: 'Triglyceride [Moles/volume] in Serum or Plasma', unit: 'mmol/L' },
  },
  {
    analyte: 'Glucose (serum/plasma)',
    molarMass: 'glucose',
    mass: { loinc: '2345-7', longCommonName: 'Glucose [Mass/volume] in Serum or Plasma', unit: 'mg/dL' },
    molar: { loinc: '14749-6', longCommonName: 'Glucose [Moles/volume] in Serum or Plasma', unit: 'mmol/L' },
  },
  {
    analyte: 'Glucose (blood)',
    molarMass: 'glucose',
    mass: { loinc: '2339-0', longCommonName: 'Glucose [Mass/volume] in Blood', unit: 'mg/dL' },
    molar: { loinc: '15074-8', longCommonName: 'Glucose [Moles/volume] in Blood', unit: 'mmol/L' },
  },
  {
    analyte: 'Creatinine',
    molarMass: 'creatinine',
    mass: { loinc: '2160-0', longCommonName: 'Creatinine [Mass/volume] in Serum or Plasma', unit: 'mg/dL' },
    molar: { loinc: '14682-9', longCommonName: 'Creatinine [Moles/volume] in Serum or Plasma', unit: 'umol/L' },
  },
  {
    analyte: 'Urea nitrogen (BUN)',
    molarMass: 'urea-nitrogen',
    mass: { loinc: '3094-0', longCommonName: 'Urea nitrogen [Mass/volume] in Serum or Plasma', unit: 'mg/dL' },
    molar: { loinc: '14937-7', longCommonName: 'Urea nitrogen [Moles/volume] in Serum or Plasma', unit: 'mmol/L' },
  },
  {
    analyte: 'Urea',
    molarMass: 'urea',
    mass: { loinc: '3091-6', longCommonName: 'Urea [Mass/volume] in Serum or Plasma', unit: 'mg/dL' },
    molar: { loinc: '22664-7', longCommonName: 'Urea [Moles/volume] in Serum or Plasma', unit: 'mmol/L' },
  },
  {
    analyte: 'Bilirubin (total)',
    molarMass: 'bilirubin',
    mass: { loinc: '1975-2', longCommonName: 'Bilirubin.total [Mass/volume] in Serum or Plasma', unit: 'mg/dL' },
    molar: { loinc: '14631-6', longCommonName: 'Bilirubin.total [Moles/volume] in Serum or Plasma', unit: 'umol/L' },
  },
  {
    analyte: 'Bilirubin (direct)',
    molarMass: 'bilirubin',
    mass: { loinc: '1968-7', longCommonName: 'Bilirubin.direct [Mass/volume] in Serum or Plasma', unit: 'mg/dL' },
    molar: { loinc: '14629-0', longCommonName: 'Bilirubin.direct [Moles/volume] in Serum or Plasma', unit: 'umol/L' },
  },
  {
    analyte: 'Bilirubin (indirect)',
    molarMass: 'bilirubin',
    mass: { loinc: '1971-1', longCommonName: 'Bilirubin.indirect [Mass/volume] in Serum or Plasma', unit: 'mg/dL' },
    molar: { loinc: '14630-8', longCommonName: 'Bilirubin.indirect [Moles/volume] in Serum or Plasma', unit: 'umol/L' },
  },
  {
    analyte: 'Urate (uric acid)',
    molarMass: 'urate',
    mass: { loinc: '3084-1', longCommonName: 'Urate [Mass/volume] in Serum or Plasma', unit: 'mg/dL' },
    molar: { loinc: '14933-6', longCommonName: 'Urate [Moles/volume] in Serum or Plasma', unit: 'umol/L' },
  },
  {
    analyte: 'Calcium',
    molarMass: 'calcium',
    mass: { loinc: '17861-6', longCommonName: 'Calcium [Mass/volume] in Serum or Plasma', unit: 'mg/dL' },
    molar: { loinc: '2000-8', longCommonName: 'Calcium [Moles/volume] in Serum or Plasma', unit: 'mmol/L' },
  },
  {
    analyte: 'Iron',
    molarMass: 'iron',
    mass: { loinc: '2498-4', longCommonName: 'Iron [Mass/volume] in Serum or Plasma', unit: 'ug/dL' },
    molar: { loinc: '14798-3', longCommonName: 'Iron [Moles/volume] in Serum or Plasma', unit: 'umol/L' },
  },
  {
    analyte: 'Magnesium',
    molarMass: 'magnesium',
    mass: { loinc: '19123-9', longCommonName: 'Magnesium [Mass/volume] in Serum or Plasma', unit: 'mg/dL' },
    molar: { loinc: '2601-3', longCommonName: 'Magnesium [Moles/volume] in Serum or Plasma', unit: 'mmol/L' },
  },
  {
    analyte: 'Phosphate',
    molarMass: 'phosphorus',
    mass: { loinc: '2777-1', longCommonName: 'Phosphate [Mass/volume] in Serum or Plasma', unit: 'mg/dL' },
    molar: { loinc: '14879-1', longCommonName: 'Phosphate [Moles/volume] in Serum or Plasma', unit: 'mmol/L' },
  },
  {
    analyte: 'Testosterone',
    molarMass: 'testosterone',
    mass: { loinc: '2986-8', longCommonName: 'Testosterone [Mass/volume] in Serum or Plasma', unit: 'ng/dL' },
    molar: { loinc: '14913-8', longCommonName: 'Testosterone [Moles/volume] in Serum or Plasma', unit: 'nmol/L' },
  },
  {
    analyte: 'Cortisol',
    molarMass: 'cortisol',
    mass: { loinc: '2143-6', longCommonName: 'Cortisol [Mass/volume] in Serum or Plasma', unit: 'ug/dL' },
    molar: { loinc: '14675-3', longCommonName: 'Cortisol [Moles/volume] in Serum or Plasma', unit: 'nmol/L' },
  },
  {
    analyte: 'Thyroxine (T4) free',
    molarMass: 'thyroxine',
    mass: { loinc: '3024-7', longCommonName: 'Thyroxine (T4) free [Mass/volume] in Serum or Plasma', unit: 'ng/dL' },
    molar: { loinc: '14920-3', longCommonName: 'Thyroxine (T4) free [Moles/volume] in Serum or Plasma', unit: 'pmol/L' },
  },
];

export const MASS_MOLAR_SIBLINGS: MassMolarSibling[] = PAIRS.map((pair) => ({
  ...pair,
  molarMassGPerMol: molarMassOf(pair.molarMass),
  massPerMolarUnit: massPerMolarUnit(pair.molarMass, pair.mass.unit, pair.molar.unit),
}));

export const SIBLING_BY_MASS_LOINC: Record<string, MassMolarSibling> = Object.fromEntries(
  MASS_MOLAR_SIBLINGS.map((pair) => [pair.mass.loinc, pair])
);

export const SIBLING_BY_MOLAR_LOINC: Record<string, MassMolarSibling> = Object.fromEntries(
  MASS_MOLAR_SIBLINGS.map((pair) => [pair.molar.loinc, pair])
);
