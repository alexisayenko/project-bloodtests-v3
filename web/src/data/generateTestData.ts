import type { DiagnosticReport } from '../types';
import type { InterchangeEnvelope, InterchangeObservation, InterchangeReport } from './envelopeTypes';
import { SCHEMA_VERSION } from './envelopeSchema';
import { parseUploadedResults } from './parseUpload';
import { loadMedications, monthKey, saveMedications, type Medications } from './medications';
import {
  loadScheduled,
  saveScheduled,
  setRowsScheduled,
  setScheduleMonth,
  type Scheduled,
} from '../components/conditions/scheduled';

/** How a lab prints one test: code, name, unit and reference range, with null for an open end. */
type Printed = readonly [loinc: string, rawName: string, unit: string, low: number | null, high: number | null];

const EN = {
  wbc: ['6690-2', 'WBC', 'x10^3/uL', 4.0, 10.0],
  rbc: ['789-8', 'RBC', 'x10^6/uL', 4.5, 5.9],
  hb: ['718-7', 'Hemoglobin', 'g/dL', 13.5, 17.5],
  hct: ['4544-3', 'Hematocrit', '%', 41, 53],
  mcv: ['787-2', 'MCV', 'fL', 80, 100],
  mch: ['785-6', 'MCH', 'pg', 27, 33],
  mchc: ['786-4', 'MCHC', 'g/dL', 32, 36],
  rdw: ['788-0', 'RDW-CV', '%', 11.5, 14.5],
  plt: ['777-3', 'Platelets', 'x10^3/uL', 150, 400],
  mpv: ['32623-1', 'MPV', 'fL', 7.5, 11.5],
  neutAbs: ['751-8', 'Neutrophils #', 'x10^3/uL', 1.8, 7.7],
  lymphAbs: ['731-0', 'Lymphocytes #', 'x10^3/uL', 1.0, 4.8],
  monoAbs: ['742-7', 'Monocytes #', 'x10^3/uL', 0.2, 0.95],
  eosAbs: ['711-2', 'Eosinophils #', 'x10^3/uL', 0, 0.5],
  basoAbs: ['704-7', 'Basophils #', 'x10^3/uL', 0, 0.2],
  neutPct: ['770-8', 'Neutrophils %', '%', 40, 75],
  lymphPct: ['736-9', 'Lymphocytes %', '%', 20, 45],
  monoPct: ['5905-5', 'Monocytes %', '%', 2, 10],
  eosPct: ['713-8', 'Eosinophils %', '%', 0, 6],
  basoPct: ['706-2', 'Basophils %', '%', 0, 1],
  glucose: ['2345-7', 'Glucose, fasting', 'mg/dL', 70, 99],
  insulin: ['20448-7', 'Insulin, fasting', 'uIU/mL', 2.6, 24.9],
  hba1c: ['4548-4', 'Hemoglobin A1c', '%', null, 5.6],
  cPeptide: ['1986-9', 'C-peptide', 'ng/mL', 1.1, 4.4],
  tc: ['2093-3', 'Cholesterol, total', 'mg/dL', null, 200],
  hdl: ['2085-9', 'HDL cholesterol', 'mg/dL', 40, null],
  ldl: ['13457-7', 'LDL cholesterol (calculated)', 'mg/dL', null, 100],
  tg: ['2571-8', 'Triglycerides', 'mg/dL', null, 150],
  apoB: ['1884-6', 'Apolipoprotein B', 'mg/dL', null, 100],
  apoA1: ['1869-7', 'Apolipoprotein A1', 'mg/dL', 104, null],
  lpa: ['10835-7', 'Lipoprotein (a)', 'mg/dL', null, 30],
  hsCrp: ['30522-7', 'hs-CRP', 'mg/L', null, 1.0],
  homocysteine: ['13965-9', 'Homocysteine', 'umol/L', null, 15],
  fibrinogen: ['3255-7', 'Fibrinogen', 'mg/dL', 200, 400],
  alt: ['1742-6', 'ALT', 'U/L', null, 41],
  ast: ['1920-8', 'AST', 'U/L', null, 40],
  ggt: ['2324-2', 'GGT', 'U/L', 8, 61],
  alp: ['6768-6', 'Alkaline phosphatase', 'U/L', 40, 129],
  tbil: ['1975-2', 'Bilirubin, total', 'mg/dL', 0.1, 1.2],
  albumin: ['1751-7', 'Albumin', 'g/dL', 3.5, 5.2],
  totalProtein: ['2885-2', 'Total protein', 'g/dL', 6.4, 8.3],
  creatinine: ['2160-0', 'Creatinine', 'mg/dL', 0.7, 1.2],
  bun: ['3094-0', 'Urea nitrogen (BUN)', 'mg/dL', 6, 20],
  uricAcid: ['3084-1', 'Uric acid', 'mg/dL', 3.4, 7.0],
  egfr: ['48642-3', 'eGFR (CKD-EPI 2021)', 'mL/min/1.73m2', 60, null],
  cystatinC: ['33863-2', 'Cystatin C', 'mg/L', 0.61, 0.95],
  acr: ['9318-7', 'Albumin/creatinine ratio, urine', 'mg/g', null, 30],
  sodium: ['2951-2', 'Sodium', 'mmol/L', 136, 145],
  potassium: ['2823-3', 'Potassium', 'mmol/L', 3.5, 5.1],
  chloride: ['2075-0', 'Chloride', 'mmol/L', 98, 107],
  tsh: ['11580-8', 'TSH', 'mIU/L', 0.27, 4.2],
  ft4: ['3024-7', 'Free T4', 'ng/dL', 0.93, 1.7],
  ft3: ['3051-0', 'Free T3', 'pg/mL', 2.0, 4.4],
  antiTpo: ['8099-4', 'Anti-TPO antibodies', 'IU/mL', null, 5.61],
  antiTg: ['8098-6', 'Anti-thyroglobulin antibodies', 'IU/mL', null, 4.11],
  calcitonin: ['1992-7', 'Calcitonin', 'pg/mL', null, 8.4],
  testosterone: ['14913-8', 'Testosterone, total', 'nmol/L', 8.6, 29.0],
  testosteroneMass: ['2986-8', 'Testosterone, total', 'ng/dL', 264, 916],
  freeTestosterone: ['2991-8', 'Free testosterone', 'pg/mL', 46, 224],
  shbg: ['13967-5', 'SHBG', 'nmol/L', 18.3, 54.1],
  lh: ['10501-5', 'LH', 'mIU/mL', 1.7, 8.6],
  fsh: ['15067-2', 'FSH', 'mIU/mL', 1.5, 12.4],
  estradiol: ['2243-4', 'Estradiol', 'pg/mL', 7.6, 42.6],
  prolactin: ['15081-3', 'Prolactin', 'mIU/L', 86, 324],
  dht: ['1848-1', 'Dihydrotestosterone', 'pg/mL', 250, 990],
  dheas: ['2191-5', 'DHEA-S', 'ug/dL', 160, 449],
  cortisol: ['2143-6', 'Cortisol, morning', 'ug/dL', 6.2, 19.4],
  acth: ['2141-0', 'ACTH', 'pg/mL', 7.2, 63.3],
  vitaminD: ['62292-8', '25-OH vitamin D', 'ng/mL', 30, 100],
  b12: ['2132-9', 'Vitamin B12', 'pg/mL', 197, 771],
  folate: ['2284-8', 'Folate', 'ng/mL', 3.9, 26.8],
  ferritin: ['2276-4', 'Ferritin', 'ng/mL', 30, 400],
  iron: ['2498-4', 'Iron', 'ug/dL', 65, 175],
  tibc: ['2500-7', 'TIBC', 'ug/dL', 250, 425],
  uibc: ['2501-5', 'UIBC', 'ug/dL', 111, 343],
  transferrin: ['3034-6', 'Transferrin', 'mg/dL', 200, 360],
  tsat: ['2502-3', 'Transferrin saturation', '%', 20, 50],
  magnesium: ['19123-9', 'Magnesium', 'mg/dL', 1.6, 2.6],
  calcium: ['17861-6', 'Calcium, total', 'mg/dL', 8.6, 10.2],
  phosphate: ['2777-1', 'Phosphate', 'mg/dL', 2.5, 4.5],
  zinc: ['5763-8', 'Zinc', 'ug/dL', 70, 120],
  pth: ['2731-8', 'Parathyroid hormone', 'pg/mL', 15, 65],
  amylase: ['1798-8', 'Amylase', 'U/L', 28, 100],
  lipase: ['3040-3', 'Lipase', 'U/L', 13, 60],
  elastase: ['25907-7', 'Pancreatic elastase-1, stool', 'ug/g', 200, null],
  osteocalcin: ['2697-1', 'Osteocalcin', 'ng/mL', 14, 46],
  ctx: ['41171-0', 'Beta-CrossLaps (CTX)', 'ng/mL', 0.115, 0.748],
  p1np: ['77370-5', 'Total P1NP', 'ng/mL', 20, 76],
  vitaminK: ['9622-2', 'Vitamin K1', 'ng/mL', 0.13, 1.19],
  balp: ['17838-4', 'Bone alkaline phosphatase', 'ug/L', 5.5, 22.9],
} satisfies Record<string, Printed>;

const UK = {
  wbc: ['6690-2', 'Лейкоцити', '×10⁹/л', 4.0, 9.0],
  rbc: ['789-8', 'Еритроцити', '×10¹²/л', 4.3, 5.7],
  hb: ['718-7', 'Гемоглобін', 'г/л', 130, 170],
  hct: ['4544-3', 'Гематокрит', '%', 39, 49],
  mcv: ['787-2', "Середній об'єм еритроцита (MCV)", 'фл', 80, 98],
  mch: ['785-6', 'Середній вміст гемоглобіну в еритроциті (MCH)', 'пг', 27, 34],
  mchc: ['786-4', 'Середня концентрація гемоглобіну в еритроциті (MCHC)', 'г/л', 320, 360],
  rdw: ['788-0', 'Ширина розподілу еритроцитів (RDW-CV)', '%', 11.6, 14.8],
  plt: ['777-3', 'Тромбоцити', '×10⁹/л', 150, 400],
  neutPct: ['770-8', 'Нейтрофіли', '%', 47, 72],
  lymphPct: ['736-9', 'Лімфоцити', '%', 19, 37],
  monoPct: ['5905-5', 'Моноцити', '%', 3, 11],
  eosPct: ['713-8', 'Еозинофіли', '%', 0.5, 5],
  basoPct: ['706-2', 'Базофіли', '%', 0, 1],
  glucose: ['14749-6', 'Глюкоза', 'ммоль/л', 3.9, 5.8],
  tc: ['14647-2', 'Холестерин загальний', 'ммоль/л', null, 5.2],
  hdl: ['14646-4', 'Холестерин ЛПВЩ', 'ммоль/л', 1.0, null],
  ldl: ['22748-8', 'Холестерин ЛПНЩ', 'ммоль/л', null, 3.0],
  tg: ['14927-8', 'Тригліцериди', 'ммоль/л', null, 1.7],
  alt: ['1742-6', 'АЛТ', 'U/L', null, 41],
  ast: ['1920-8', 'АСТ', 'U/L', null, 40],
  alp: ['6768-6', 'Лужна фосфатаза', 'U/L', 40, 130],
  tbil: ['14631-6', 'Білірубін загальний', 'мкмоль/л', 3.4, 20.5],
  amylase: ['1798-8', 'α-Амілаза', 'U/L', 28, 100],
  lipase: ['3040-3', 'Ліпаза', 'U/L', 13, 60],
  tsh: ['11580-8', 'ТТГ', 'мкМО/мл', 0.35, 4.94],
  ft4: ['14920-3', 'Т4 вільний', 'пмоль/л', 9.0, 19.0],
  ft3: ['3051-0', 'Т3 вільний', 'пг/мл', 1.71, 3.71],
  antiTpo: ['8099-4', 'Антитіла до ТПО', 'МО/мл', null, 5.61],
  testosterone: ['14913-8', 'Тестостерон загальний', 'нмоль/л', 8.6, 29.0],
  shbg: ['13967-5', 'ГЗСГ', 'нмоль/л', 18.3, 54.1],
  lh: ['10501-5', 'ЛГ', 'мМО/мл', 1.7, 8.6],
  fsh: ['15067-2', 'ФСГ', 'мМО/мл', 1.5, 12.4],
  prolactin: ['15081-3', 'Пролактин', 'мМО/л', 86, 324],
  estradiol: ['2243-4', 'Естрадіол', 'пг/мл', 7.6, 42.6],
  dheas: ['2191-5', 'ДГЕА-С', 'мкг/дл', 160, 449],
  cortisol: ['14675-3', 'Кортизол', 'нмоль/л', 138, 635],
  acth: ['2141-0', 'АКТГ', 'пг/мл', 7.2, 63.3],
  vitaminD: ['62292-8', 'Вітамін D (25-OH)', 'нг/мл', 30, 100],
  b12: ['2132-9', 'Вітамін B12', 'пг/мл', 197, 771],
  folate: ['2284-8', 'Фолієва кислота', 'нг/мл', 3.9, 26.8],
  ferritin: ['2276-4', 'Феритин', 'нг/мл', 30, 400],
  iron: ['14798-3', 'Залізо', 'мкмоль/л', 12.5, 32.2],
  transferrin: ['3034-6', 'Трансферин', 'г/л', 2.0, 3.6],
  magnesium: ['2601-3', 'Магній', 'ммоль/л', 0.66, 1.07],
  calcium: ['2000-8', 'Кальцій загальний', 'ммоль/л', 2.15, 2.55],
  phosphate: ['14879-1', 'Фосфор неорганічний', 'ммоль/л', 0.81, 1.45],
  zinc: ['5763-8', 'Цинк', 'мкг/дл', 70, 120],
  pth: ['2731-8', 'Паратгормон', 'пг/мл', 15, 65],
  fibrinogen: ['3255-7', 'Фібриноген', 'г/л', 2.0, 4.0],
  // "у.о." (conventional units) is in no unit table, so this row carries the lower-severity unit warning.
  inr: ['6301-6', 'МНВ', 'у.о.', 0.8, 1.2],
} satisfies Record<string, Printed>;

const RU = {
  tc: ['14647-2', 'Холестерин общий', 'ммоль/л', null, 5.2],
  hdl: ['14646-4', 'Холестерин ЛПВП', 'ммоль/л', 1.0, null],
  ldl: ['22748-8', 'Холестерин ЛПНП', 'ммоль/л', null, 3.0],
  tg: ['14927-8', 'Триглицериды', 'ммоль/л', null, 1.7],
  apoB: ['1884-6', 'Аполипопротеин B', 'г/л', 0.6, 1.2],
  apoA1: ['1869-7', 'Аполипопротеин A1', 'г/л', 1.04, 2.02],
  hsCrp: ['30522-7', 'С-реактивный белок высокочувствительный', 'мг/л', null, 1.0],
  glucose: ['14749-6', 'Глюкоза', 'ммоль/л', 3.9, 5.5],
  insulin: ['20448-7', 'Инсулин', 'мкМЕ/мл', 2.6, 24.9],
  hba1c: ['4548-4', 'Гликированный гемоглобин HbA1c', '%', 4.0, 6.0],
  cPeptide: ['1986-9', 'С-пептид', 'нг/мл', 1.1, 4.4],
  alt: ['1742-6', 'АЛТ', 'Ед/л', null, 41],
  ast: ['1920-8', 'АСТ', 'Ед/л', null, 40],
  ggt: ['2324-2', 'ГГТ', 'Ед/л', null, 55],
  alp: ['6768-6', 'Щелочная фосфатаза', 'Ед/л', 40, 130],
  tbil: ['14631-6', 'Билирубин общий', 'мкмоль/л', 3.4, 20.5],
  dbil: ['14629-0', 'Билирубин прямой', 'мкмоль/л', null, 5.0],
  tsh: ['11580-8', 'ТТГ', 'мкМЕ/мл', 0.4, 4.0],
  ft4: ['14920-3', 'Т4 свободный', 'пмоль/л', 9.0, 19.0],
  ft3: ['3051-0', 'Т3 свободный', 'пг/мл', 2.0, 4.4],
  creatinine: ['14682-9', 'Креатинин', 'мкмоль/л', 62, 106],
  // A molar unit under the mass code: the one deliberate code error, answered by the sibling-code warning and its chip.
  creatinineMiscoded: ['2160-0', 'Креатинин', 'мкмоль/л', 62, 106],
  urea: ['22664-7', 'Мочевина', 'ммоль/л', 2.8, 7.2],
  uricAcid: ['14933-6', 'Мочевая кислота', 'мкмоль/л', 202, 416],
  egfr: ['48642-3', 'СКФ (CKD-EPI)', 'mL/min/1.73m2', 60, null],
  sodium: ['2951-2', 'Натрий', 'ммоль/л', 136, 145],
  potassium: ['2823-3', 'Калий', 'ммоль/л', 3.5, 5.1],
  chloride: ['2075-0', 'Хлориды', 'ммоль/л', 98, 107],
} satisfies Record<string, Printed>;

const COMPARATOR_RE = /^(<=|>=|<|>)(\d+(?:\.\d+)?)$/;

function valueFields(printed: number | string): Pick<InterchangeObservation, 'value' | 'comparator' | 'rawValue'> {
  if (typeof printed === 'number') return { value: printed };
  const match = COMPARATOR_RE.exec(printed);
  if (!match) throw new Error(`unparseable test value "${printed}"`);
  return { value: Number(match[2]), comparator: match[1] as InterchangeObservation['comparator'], rawValue: printed };
}

function observation([loinc, rawName, unit, low, high]: Printed, printed: number | string): InterchangeObservation {
  let range: NonNullable<InterchangeObservation['referenceRanges']>[number] | undefined;
  if (low != null && high != null) range = { low, high };
  else if (high != null) range = { high, text: `< ${high}` };
  else if (low != null) range = { low, text: `> ${low}` };
  return { loinc, rawName, ...valueFields(printed), unit, ...(range && { referenceRanges: [range] }) };
}

function report<K extends string>(
  accession: number,
  lab: string,
  date: string,
  printed: Record<K, Printed>,
  values: Partial<Record<K, number | string>>
): InterchangeReport {
  return {
    lab,
    collectedAt: `${date}T07:30:00Z`,
    // Keeps a generated report's session id apart from any real report of the same lab and date.
    identifiers: { accession: `demo-${String(accession).padStart(2, '0')}` },
    observations: (Object.entries(values) as [K, number | string][]).map(([key, value]) => observation(printed[key], value)),
  };
}

/**
 * One synthetic patient over five years across four labs (Synevo, Esculab and
 * Medis are priced, Dila is not), 2023 left as a gap. Fixed dates keep every
 * session id stable, so generating again replaces these reports rather than
 * adding a second copy.
 */
export function buildTestEnvelope(): InterchangeEnvelope {
  return {
    schema: SCHEMA_VERSION,
    notes: 'Synthetic demo data from Generate Test Data.',
    diagnosticReports: [
      report(1, 'Synevo', '2021-03-16', EN, {
        wbc: 6.2, rbc: 5.02, hb: 15.1, hct: 44.6, mcv: 88.8, mch: 30.1, mchc: 33.9, rdw: 12.9, plt: 238, mpv: 9.8,
        neutAbs: 3.6, lymphAbs: 1.9, monoAbs: 0.45, eosAbs: 0.2, basoAbs: 0.05,
        neutPct: 58.1, lymphPct: 30.6, monoPct: 7.3, eosPct: 3.2, basoPct: 0.8,
        glucose: 104, insulin: 16.8, hba1c: 5.8, tc: 232, hdl: 44, ldl: 154, tg: 168,
        alt: 48, ast: 31, ggt: 52, alp: 78, tbil: 0.9, albumin: 4.6,
        creatinine: 1.02, bun: 15, uricAcid: 7.4,
        tsh: 6.8, ft4: 1.0, ft3: 2.9,
        vitaminD: 18.5, ferritin: 142, iron: 98, tibc: 312, hsCrp: 2.4,
      }),
      report(2, 'Esculab', '2021-09-21', UK, {
        wbc: 5.8, rbc: 4.96, hb: 149, hct: 44.1, mcv: 88.9, mch: 30.0, mchc: 338, rdw: 13.1, plt: 251,
        neutPct: 55.2, lymphPct: 33.4, monoPct: 7.9, eosPct: 2.9, basoPct: 0.6,
        glucose: 5.9, tsh: 3.1, ferritin: 138,
      }),
      report(3, 'Medis', '2022-02-08', RU, {
        tc: 6.1, hdl: 1.09, ldl: 4.1, tg: 2.02,
        glucose: 5.8, insulin: 15.2, hba1c: 5.9,
        alt: 52, ast: 34, ggt: 58, alp: 81, tbil: 14.2, dbil: 3.1,
        tsh: 2.4,
      }),
      report(4, 'Dila', '2022-10-12', EN, {
        tsh: 1.9, ft4: 1.21, ft3: 3.1, antiTpo: 186, antiTg: 42, calcitonin: '<2.0',
        testosterone: 13.8, shbg: 38.5, lh: 4.6, fsh: 5.2, estradiol: 31, prolactin: 212,
        dheas: 268, cortisol: 14.6, acth: 28, albumin: 4.5,
      }),
      report(5, 'Synevo', '2024-04-18', EN, {
        wbc: 7.1, rbc: 5.11, hb: 15.4, hct: 45.3, mcv: 88.6, mch: 30.1, mchc: 34.0, rdw: 13.0, plt: 262, mpv: 10.1,
        neutAbs: 4.3, lymphAbs: 2.0, monoAbs: 0.52, eosAbs: 0.24, basoAbs: 0.04,
        neutPct: 60.6, lymphPct: 28.2, monoPct: 7.3, eosPct: 3.4, basoPct: 0.5,
        tc: 246, hdl: 41, ldl: 162, tg: 214, apoB: 128, apoA1: 132, lpa: 38, hsCrp: 3.1, homocysteine: 13.8,
        fibrinogen: 342,
        glucose: 109, insulin: 21.4, hba1c: 6.0, cPeptide: 3.6,
        creatinine: 1.08, bun: 16, uricAcid: 7.8, egfr: 86, cystatinC: 0.92, sodium: 141, potassium: 4.4,
        chloride: 102,
        alt: 61, ast: 38, ggt: 67, alp: 84, tbil: 0.8, albumin: 4.7, totalProtein: 7.3,
      }),
      report(6, 'Esculab', '2024-04-18', UK, {
        vitaminD: 24.6, b12: 412, folate: 9.8, ferritin: 156, iron: 19.4, transferrin: 2.61,
        magnesium: 0.84, calcium: 2.38, phosphate: 1.02, zinc: 84, pth: 58,
      }),
      report(7, 'Medis', '2024-10-03', RU, {
        tsh: 2.1, ft4: 15.8, ft3: 3.2,
        tc: 6.4, hdl: 1.03, ldl: 4.3, tg: 2.35,
        glucose: 6.2, insulin: 22.8, hba1c: 6.1,
        alt: 64, ast: 39, ggt: 71,
        creatinineMiscoded: 94, urea: 5.6, uricAcid: 452,
      }),
      report(8, 'Synevo', '2025-02-11', EN, {
        tsh: 1.7, ft4: 1.28, ft3: 3.3,
        testosteroneMass: 412, freeTestosterone: 72, shbg: 36.2, lh: 5.1, fsh: 4.8, estradiol: 28, prolactin: 188,
        dht: 460, dheas: 245, cortisol: 16.2, acth: 34, albumin: 4.6,
      }),
      report(9, 'Esculab', '2025-06-17', UK, {
        wbc: 6.6, rbc: 5.08, hb: 153, hct: 45.0, mcv: 88.6, mch: 30.1, mchc: 340, rdw: 12.8, plt: 244,
        neutPct: 57.4, lymphPct: 31.2, monoPct: 7.6, eosPct: 3.1, basoPct: 0.7,
        glucose: 5.6, tc: 5.9, hdl: 1.12, ldl: 3.9, tg: 1.95,
        alt: 44, ast: 30, alp: 76, tbil: 12.8, amylase: 68, lipase: 41,
      }),
      report(10, 'Synevo', '2025-09-09', EN, {
        iron: 112, tibc: 305, uibc: 193, transferrin: 244, tsat: 37, ferritin: 124, b12: 438, folate: 11.2,
        vitaminD: 38.4, magnesium: 2.0, calcium: 9.5, phosphate: 3.3, zinc: 88,
        creatinine: 1.06, cystatinC: 0.94, egfr: 88, acr: 12,
      }),
      report(11, 'Dila', '2025-11-20', EN, {
        amylase: 72, lipase: 38, elastase: 412,
        glucose: 98, insulin: 12.1, hba1c: 5.6, cPeptide: 2.4, tg: 148,
        osteocalcin: 21.4, ctx: 0.38, p1np: 48, vitaminK: 0.62, balp: 14.2,
        calcium: 9.6, phosphate: 3.4, magnesium: 2.1, vitaminD: 41.2, pth: 42,
      }),
      report(12, 'Dila', '2026-01-14', UK, {
        tsh: 1.6, ft4: 16.4, ft3: 3.4, antiTpo: 142,
        testosterone: 15.2, shbg: 37.8, lh: 4.9, fsh: 5.0, prolactin: 196, estradiol: 26,
        dheas: 252, cortisol: 412, acth: 31,
      }),
      report(13, 'Medis', '2026-02-10', RU, {
        tc: 6.3, hdl: 1.08, ldl: 4.2, tg: 2.2, apoB: 1.24, apoA1: 1.28, hsCrp: 2.8,
        glucose: 5.7, insulin: 14.6, hba1c: 5.8, cPeptide: 2.9,
        alt: 46, ast: 32, ggt: 54,
        creatinine: 91, urea: 5.4, uricAcid: 418, egfr: 90, sodium: 140, potassium: 4.5, chloride: 103,
      }),
      report(14, 'Synevo', '2026-05-19', EN, {
        wbc: 6.4, rbc: 5.05, hb: 15.2, hct: 44.9, mcv: 88.9, mch: 30.1, mchc: 33.9, rdw: 12.7, plt: 229, mpv: 9.9,
        neutAbs: 3.7, lymphAbs: 1.95, monoAbs: 0.49, eosAbs: 0.22, basoAbs: 0.04,
        neutPct: 57.8, lymphPct: 30.5, monoPct: 7.7, eosPct: 3.4, basoPct: 0.6,
        tc: 172, hdl: 47, ldl: 98, tg: 136, apoB: 84, apoA1: 138, hsCrp: 0.8,
        glucose: 96, insulin: 9.8, hba1c: 5.5,
        alt: 34, ast: 27, ggt: 41, alp: 72, tbil: 0.7, albumin: 4.6,
        creatinine: 1.04, bun: 15, uricAcid: 6.8,
        tsh: 1.8, ft4: 1.24, ft3: 3.2,
        vitaminD: 48.5, b12: 468, ferritin: 118, iron: 104, tibc: 318,
        testosterone: 16.1, shbg: 39.2, lh: 4.4, estradiol: 27, cortisol: 15.1, dheas: 238, acth: 29,
      }),
      report(15, 'Esculab', '2026-08-25', UK, {
        wbc: 6.0, rbc: 4.98, hb: 150, hct: 44.2, mcv: 88.8, mch: 30.1, mchc: 339, rdw: 12.9, plt: 236,
        neutPct: 56.8, lymphPct: 32.1, monoPct: 7.4, eosPct: 3.0, basoPct: 0.7,
        glucose: 5.3, tc: 4.4, hdl: 1.24, ldl: 2.5, tg: 1.46,
        alt: 31, ast: 26, fibrinogen: 3.1, inr: 1.02,
      }),
    ],
  };
}

/** The demo reports, read through the same parse path as an upload so normalization runs on them. */
export function generateTestData(): DiagnosticReport[] {
  return parseUploadedResults(buildTestEnvelope());
}

const TEST_MEDICATIONS: { name: string; dosage: string; taken: (previousYear: boolean, month: number) => boolean }[] = [
  { name: 'Levothyroxine', dosage: '75 mcg once daily', taken: () => true },
  { name: 'Metformin', dosage: '500 mg twice daily', taken: (previousYear, month) => !previousYear || month >= 5 },
  { name: 'Vitamin D3', dosage: '2000 IU daily', taken: (_, month) => month <= 3 || month >= 9 },
  { name: 'Atorvastatin', dosage: '10 mg at night', taken: (previousYear, month) => !previousYear && month >= 1 },
  {
    name: 'Magnesium citrate',
    dosage: '200 mg daily',
    taken: (previousYear, month) => (previousYear ? month >= 2 && month <= 7 : month >= 4 && month <= 6),
  },
];

/** The demo medications appended, marked across last year and this year up to `today`; a name already present is skipped. */
export function withTestMedications(meds: Medications, today: Date, newId: () => string): Medications {
  const year = today.getFullYear();
  const present = new Set(meds.rows.map((row) => row.name.trim().toLowerCase()));
  const added = TEST_MEDICATIONS.filter((med) => !present.has(med.name.toLowerCase())).map((med) => ({
    id: newId(),
    name: med.name,
    dosage: med.dosage,
    months: [year - 1, year].flatMap((y) =>
      Array.from({ length: y < year ? 12 : today.getMonth() + 1 }, (_, month) => month)
        .filter((month) => med.taken(y < year, month))
        .map((month) => monthKey(y, month))
    ),
  }));
  if (added.length === 0) return meds;
  return {
    years: Array.from(new Set([...meds.years, year - 1, year])).sort((a, b) => a - b),
    rows: [...meds.rows, ...added],
  };
}

// An FBC pair (priced once, as a bundle), HbA1c and insulin (not priced at
// Esculab), TSH (priced nowhere), and the inputs of a few indices.
export const TEST_SCHEDULE_LOINCS = ['718-7', '6690-2', '2345-7', '20448-7', '4548-4', '2093-3', '2085-9', '2571-8', '11580-8'];

/** A demo schedule for next month, only where nothing is scheduled yet; any other schedule is returned untouched. */
export function withTestSchedule(scheduled: Scheduled, today: Date): Scheduled {
  if (scheduled.loincs.length > 0 || scheduled.indices.length > 0) return scheduled;
  const seeded = setRowsScheduled(scheduled, TEST_SCHEDULE_LOINCS.map((loinc) => [loinc]), true);
  if (scheduled.month) return seeded;
  const next = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  return setScheduleMonth(seeded, monthKey(next.getFullYear(), next.getMonth()));
}

function newRowId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/** What Generate Test Data does: merges the reports, then seeds medications and a schedule without overwriting either. */
export function applyTestData(loadReports: (groups: DiagnosticReport[]) => void, today = new Date()): void {
  loadReports(generateTestData());
  const meds = loadMedications(today.getFullYear());
  const nextMeds = withTestMedications(meds, today, newRowId);
  if (nextMeds !== meds) saveMedications(nextMeds);
  const scheduled = loadScheduled();
  const nextScheduled = withTestSchedule(scheduled, today);
  if (nextScheduled !== scheduled) saveScheduled(nextScheduled);
}
