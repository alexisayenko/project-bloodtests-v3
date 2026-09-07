// Curated mass↔molar LOINC sibling pairs: the same analyte measured on a
// [Mass/volume] scale and on a [Moles/volume] scale, which LOINC gives two
// different codes. Long common names are as published by LOINC (verified
// against the NLM Clinical Tables loinc_items API).
//
// `massPerMolarUnit` is data only — it is the factor that would convert a
// value in `molar.unit` to `mass.unit`. Nothing in this app converts values:
// a molar unit under a mass code is a CODE problem, and the remedy is the
// sibling code, never a rewritten number (ADR-0003).

export interface SiblingCode {
  loinc: string;
  longCommonName: string;
  unit: string;
}

export interface MassMolarSibling {
  analyte: string;
  mass: SiblingCode;
  molar: SiblingCode;
  massPerMolarUnit: number;
  molarMassGPerMol?: number;
  note?: string;
}

export const MASS_MOLAR_SIBLINGS: MassMolarSibling[] = [
  {
    analyte: 'Cholesterol (total)',
    mass: { loinc: '2093-3', longCommonName: 'Cholesterol [Mass/volume] in Serum or Plasma', unit: 'mg/dL' },
    molar: { loinc: '14647-2', longCommonName: 'Cholesterol [Moles/volume] in Serum or Plasma', unit: 'mmol/L' },
    massPerMolarUnit: 38.67,
    molarMassGPerMol: 386.65,
  },
  {
    analyte: 'Cholesterol in HDL',
    mass: { loinc: '2085-9', longCommonName: 'Cholesterol in HDL [Mass/volume] in Serum or Plasma', unit: 'mg/dL' },
    molar: { loinc: '14646-4', longCommonName: 'Cholesterol in HDL [Moles/volume] in Serum or Plasma', unit: 'mmol/L' },
    massPerMolarUnit: 38.67,
    molarMassGPerMol: 386.65,
  },
  {
    analyte: 'Cholesterol in LDL',
    mass: {
      loinc: '13457-7',
      longCommonName: 'Cholesterol in LDL [Mass/volume] in Serum or Plasma by calculation',
      unit: 'mg/dL',
    },
    molar: { loinc: '22748-8', longCommonName: 'Cholesterol in LDL [Moles/volume] in Serum or Plasma', unit: 'mmol/L' },
    massPerMolarUnit: 38.67,
    molarMassGPerMol: 386.65,
    note: 'The mass code is method-specific (by calculation); the molar code is not.',
  },
  {
    analyte: 'Triglyceride',
    mass: { loinc: '2571-8', longCommonName: 'Triglyceride [Mass/volume] in Serum or Plasma', unit: 'mg/dL' },
    molar: { loinc: '14927-8', longCommonName: 'Triglyceride [Moles/volume] in Serum or Plasma', unit: 'mmol/L' },
    massPerMolarUnit: 88.57,
    molarMassGPerMol: 885.4,
    note: 'Molar mass is the conventional triolein equivalent, not a single molecular species.',
  },
  {
    analyte: 'Glucose (serum/plasma)',
    mass: { loinc: '2345-7', longCommonName: 'Glucose [Mass/volume] in Serum or Plasma', unit: 'mg/dL' },
    molar: { loinc: '14749-6', longCommonName: 'Glucose [Moles/volume] in Serum or Plasma', unit: 'mmol/L' },
    massPerMolarUnit: 18.016,
    molarMassGPerMol: 180.16,
  },
  {
    analyte: 'Glucose (blood)',
    mass: { loinc: '2339-0', longCommonName: 'Glucose [Mass/volume] in Blood', unit: 'mg/dL' },
    molar: { loinc: '15074-8', longCommonName: 'Glucose [Moles/volume] in Blood', unit: 'mmol/L' },
    massPerMolarUnit: 18.016,
    molarMassGPerMol: 180.16,
  },
  {
    analyte: 'Creatinine',
    mass: { loinc: '2160-0', longCommonName: 'Creatinine [Mass/volume] in Serum or Plasma', unit: 'mg/dL' },
    molar: { loinc: '14682-9', longCommonName: 'Creatinine [Moles/volume] in Serum or Plasma', unit: 'umol/L' },
    massPerMolarUnit: 0.011312,
    molarMassGPerMol: 113.12,
  },
  {
    analyte: 'Urea nitrogen (BUN)',
    mass: { loinc: '3094-0', longCommonName: 'Urea nitrogen [Mass/volume] in Serum or Plasma', unit: 'mg/dL' },
    molar: { loinc: '14937-7', longCommonName: 'Urea nitrogen [Moles/volume] in Serum or Plasma', unit: 'mmol/L' },
    massPerMolarUnit: 2.801,
    note: 'Nitrogen basis: each urea molecule carries two nitrogen atoms (2 × 14.007 g/mol), so the factor is 28.014/10, not a molar mass of urea.',
  },
  {
    analyte: 'Urea',
    mass: { loinc: '3091-6', longCommonName: 'Urea [Mass/volume] in Serum or Plasma', unit: 'mg/dL' },
    molar: { loinc: '22664-7', longCommonName: 'Urea [Moles/volume] in Serum or Plasma', unit: 'mmol/L' },
    massPerMolarUnit: 6.006,
    molarMassGPerMol: 60.06,
  },
  {
    analyte: 'Bilirubin (total)',
    mass: { loinc: '1975-2', longCommonName: 'Bilirubin.total [Mass/volume] in Serum or Plasma', unit: 'mg/dL' },
    molar: { loinc: '14631-6', longCommonName: 'Bilirubin.total [Moles/volume] in Serum or Plasma', unit: 'umol/L' },
    massPerMolarUnit: 0.058466,
    molarMassGPerMol: 584.66,
  },
  {
    analyte: 'Bilirubin (direct)',
    mass: { loinc: '1968-7', longCommonName: 'Bilirubin.direct [Mass/volume] in Serum or Plasma', unit: 'mg/dL' },
    molar: { loinc: '14629-0', longCommonName: 'Bilirubin.direct [Moles/volume] in Serum or Plasma', unit: 'umol/L' },
    massPerMolarUnit: 0.058466,
    molarMassGPerMol: 584.66,
  },
  {
    analyte: 'Bilirubin (indirect)',
    mass: { loinc: '1971-1', longCommonName: 'Bilirubin.indirect [Mass/volume] in Serum or Plasma', unit: 'mg/dL' },
    molar: { loinc: '14630-8', longCommonName: 'Bilirubin.indirect [Moles/volume] in Serum or Plasma', unit: 'umol/L' },
    massPerMolarUnit: 0.058466,
    molarMassGPerMol: 584.66,
    note: 'Indirect bilirubin is total minus direct, so it shares bilirubin’s molar mass.',
  },
  {
    analyte: 'Urate (uric acid)',
    mass: { loinc: '3084-1', longCommonName: 'Urate [Mass/volume] in Serum or Plasma', unit: 'mg/dL' },
    molar: { loinc: '14933-6', longCommonName: 'Urate [Moles/volume] in Serum or Plasma', unit: 'umol/L' },
    massPerMolarUnit: 0.016811,
    molarMassGPerMol: 168.11,
  },
  {
    analyte: 'Calcium',
    mass: { loinc: '17861-6', longCommonName: 'Calcium [Mass/volume] in Serum or Plasma', unit: 'mg/dL' },
    molar: { loinc: '2000-8', longCommonName: 'Calcium [Moles/volume] in Serum or Plasma', unit: 'mmol/L' },
    massPerMolarUnit: 4.008,
    molarMassGPerMol: 40.078,
  },
  {
    analyte: 'Iron',
    mass: { loinc: '2498-4', longCommonName: 'Iron [Mass/volume] in Serum or Plasma', unit: 'ug/dL' },
    molar: { loinc: '14798-3', longCommonName: 'Iron [Moles/volume] in Serum or Plasma', unit: 'umol/L' },
    massPerMolarUnit: 5.5845,
    molarMassGPerMol: 55.845,
  },
  {
    analyte: 'Magnesium',
    mass: { loinc: '19123-9', longCommonName: 'Magnesium [Mass/volume] in Serum or Plasma', unit: 'mg/dL' },
    molar: { loinc: '2601-3', longCommonName: 'Magnesium [Moles/volume] in Serum or Plasma', unit: 'mmol/L' },
    massPerMolarUnit: 2.4305,
    molarMassGPerMol: 24.305,
  },
  {
    analyte: 'Phosphate',
    mass: { loinc: '2777-1', longCommonName: 'Phosphate [Mass/volume] in Serum or Plasma', unit: 'mg/dL' },
    molar: { loinc: '14879-1', longCommonName: 'Phosphate [Moles/volume] in Serum or Plasma', unit: 'mmol/L' },
    massPerMolarUnit: 3.0974,
    molarMassGPerMol: 30.974,
    note: 'Both scales report elemental phosphorus, so the factor is the atomic mass of P.',
  },
  {
    analyte: 'Testosterone',
    mass: { loinc: '2986-8', longCommonName: 'Testosterone [Mass/volume] in Serum or Plasma', unit: 'ng/dL' },
    molar: { loinc: '14913-8', longCommonName: 'Testosterone [Moles/volume] in Serum or Plasma', unit: 'nmol/L' },
    massPerMolarUnit: 28.842,
    molarMassGPerMol: 288.42,
  },
  {
    analyte: 'Cortisol',
    mass: { loinc: '2143-6', longCommonName: 'Cortisol [Mass/volume] in Serum or Plasma', unit: 'ug/dL' },
    molar: { loinc: '14675-3', longCommonName: 'Cortisol [Moles/volume] in Serum or Plasma', unit: 'nmol/L' },
    massPerMolarUnit: 0.036246,
    molarMassGPerMol: 362.46,
  },
  {
    analyte: 'Thyroxine (T4) free',
    mass: { loinc: '3024-7', longCommonName: 'Thyroxine (T4) free [Mass/volume] in Serum or Plasma', unit: 'ng/dL' },
    molar: { loinc: '14920-3', longCommonName: 'Thyroxine (T4) free [Moles/volume] in Serum or Plasma', unit: 'pmol/L' },
    massPerMolarUnit: 0.077687,
    molarMassGPerMol: 776.87,
  },
];

export const SIBLING_BY_MASS_LOINC: Record<string, MassMolarSibling> = Object.fromEntries(
  MASS_MOLAR_SIBLINGS.map((pair) => [pair.mass.loinc, pair])
);

export const SIBLING_BY_MOLAR_LOINC: Record<string, MassMolarSibling> = Object.fromEntries(
  MASS_MOLAR_SIBLINGS.map((pair) => [pair.molar.loinc, pair])
);
