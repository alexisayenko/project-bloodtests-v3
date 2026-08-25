import { useState } from 'react';

type Observation = { short: string; full: string; longCommonName: string; loinc: string };

const CONDITIONS: { name: string; tests: Observation[] }[] = [
  {
    name: 'Hypogonadism',
    tests: [
      { short: 'T', full: 'Testosterone', longCommonName: 'Testosterone [Mass/volume] in Serum or Plasma', loinc: '14913-8' },
      { short: 'FT', full: 'Testosterone, Free', longCommonName: 'Testosterone Free [Mass/volume] in Serum or Plasma', loinc: '2991-8' },
      { short: 'LH', full: 'Luteinizing Hormone', longCommonName: 'Luteinizing hormone [Units/volume] in Serum or Plasma', loinc: '10501-5' },
      { short: 'FSH', full: 'Follicle Stimulating Hormone', longCommonName: 'Follicle stimulating hormone [Units/volume] in Serum or Plasma', loinc: '15067-2' },
      { short: 'PRL', full: 'Total Prolactin', longCommonName: 'Prolactin [Units/volume] in Serum or Plasma', loinc: '15081-3' },
      { short: 'SHBG', full: 'SHBG', longCommonName: 'Sex hormone binding globulin [Mass/volume] in Serum or Plasma', loinc: '2942-1' },
      { short: 'E2', full: 'Estradiol', longCommonName: 'Estradiol [Mass/volume] in Serum or Plasma', loinc: '2243-4' },
      { short: 'DHT', full: 'Dihydrotestosterone', longCommonName: 'Dihydrotestosterone [Mass/volume] in Serum or Plasma', loinc: '26454-9' },
      { short: 'DHEA-S', full: 'DHEA-S', longCommonName: 'Dehydroepiandrosterone sulfate [Mass/volume] in Serum or Plasma', loinc: '2191-5' },
    ],
  },
  {
    name: 'Hypothyroidism',
    tests: [
      { short: 'TSH', full: 'TSH', longCommonName: 'Thyrotropin [Units/volume] in Serum or Plasma', loinc: '11580-8' },
      { short: 'FT3', full: 'Free T3', longCommonName: 'Triiodothyronine Free [Mass/volume] in Serum or Plasma', loinc: '3051-0' },
      { short: 'FT4', full: 'Free T4', longCommonName: 'Thyroxine Free [Mass/volume] in Serum or Plasma', loinc: '3024-7' },
      { short: 'TPO', full: 'Anti-TPO', longCommonName: 'Thyroid peroxidase Ab [Units/volume] in Serum or Plasma', loinc: '8099-4' },
      { short: 'TG', full: 'Anti-TG', longCommonName: 'Thyroglobulin Ab [Units/volume] in Serum or Plasma', loinc: '8098-6' },
      { short: 'TRAb', full: 'TRAb', longCommonName: 'Thyrotropin receptor Ab [Units/volume] in Serum or Plasma', loinc: '5385-0' },
      { short: 'CT', full: 'Calcitonin', longCommonName: 'Calcitonin [Mass/volume] in Serum or Plasma', loinc: '1992-7' },
    ],
  },
  {
    name: 'Adrenal',
    tests: [
      { short: 'ACTH', full: 'ACTH', longCommonName: 'Corticotropin [Mass/volume] in Plasma', loinc: '2141-0' },
      { short: 'CORT', full: 'Cortisol', longCommonName: 'Cortisol [Mass/volume] in Serum or Plasma', loinc: '2143-6' },
    ],
  },
  {
    name: 'Insulin Resistance',
    tests: [
      { short: 'INS', full: 'Insulin', longCommonName: 'Insulin [Units/volume] in Serum or Plasma', loinc: '20448-7' },
      { short: 'GLU', full: 'Glucose Serum', longCommonName: 'Glucose [Mass/volume] in Blood', loinc: '2339-0' },
      { short: 'A1c', full: 'HbA1c (NGSP)', longCommonName: 'Hemoglobin A1c/Hemoglobin.total in Blood by NGSP', loinc: '4548-4' },
      { short: 'A1cI', full: 'HbA1c (IFCC)', longCommonName: 'Hemoglobin A1c/Hemoglobin.total in Blood by IFCC', loinc: '59261-8' },
      { short: 'GA', full: 'Glycated Albumin', longCommonName: 'Glycated albumin/Albumin.total in Serum or Plasma', loinc: '13979-8' },
      { short: 'FRA', full: 'Fructosamine', longCommonName: 'Fructosamine [Mass/volume] in Serum or Plasma', loinc: '1557-8' },
      { short: 'C-P', full: 'C-Peptide', longCommonName: 'C peptide [Mass/volume] in Serum or Plasma', loinc: '1986-0' },
    ],
  },
  {
    name: 'Cardiovascular Risk',
    tests: [
      { short: 'CRP', full: 'C-Reactive Protein', longCommonName: 'C reactive protein [Mass/volume] in Serum or Plasma', loinc: '1988-5' },
      { short: 'hsCRP', full: 'High-Sensitivity CRP', longCommonName: 'C reactive protein [Mass/volume] in Serum or Plasma by High sensitivity method', loinc: '30522-7' },
      { short: 'IL6', full: 'Interleukin-6', longCommonName: 'Interleukin 6 [Mass/volume] in Serum or Plasma', loinc: '26881-3' },
      { short: 'TNFA', full: 'TNF-alpha', longCommonName: 'Tumor necrosis factor alpha [Mass/volume] in Serum or Plasma', loinc: '3167-4' },
      { short: 'oxLDL', full: 'Oxidized LDL', longCommonName: 'Oxidized LDL [Mass/volume] in Serum or Plasma', loinc: '49246-0' },
      { short: 'LEP', full: 'Leptin', longCommonName: 'Leptin [Mass/volume] in Serum or Plasma', loinc: '2293-7' },
      { short: 'ADIPO', full: 'Adiponectin', longCommonName: 'Adiponectin [Mass/volume] in Serum or Plasma', loinc: '56660-9' },
      { short: 'HCY', full: 'Homocysteine', longCommonName: 'Homocysteine [Moles/volume] in Serum or Plasma', loinc: '2160-0' },
      { short: 'FIB', full: 'Fibrinogen', longCommonName: 'Fibrinogen [Mass/volume] in Platelet poor plasma by Coagulation assay', loinc: '3255-7' },
    ],
  },
  {
    name: 'Fatty Liver',
    tests: [
      { short: 'ALP', full: 'Alkaline Phosphatase', longCommonName: 'Alkaline phosphatase [Enzymatic activity/volume] in Serum or Plasma', loinc: '6768-6' },
      { short: 'DBIL', full: 'Direct Bilirubin', longCommonName: 'Bilirubin.direct [Mass/volume] in Serum or Plasma', loinc: '1968-7' },
      { short: 'IBIL', full: 'Indirect Bilirubin', longCommonName: 'Bilirubin.indirect [Mass/volume] in Serum or Plasma', loinc: '1971-1' },
      { short: 'TBIL', full: 'Total Bilirubin', longCommonName: 'Bilirubin.total [Mass/volume] in Serum or Plasma', loinc: '1975-2' },
      { short: 'AST', full: 'Aspartate Aminotransferase', longCommonName: 'Aspartate aminotransferase [Enzymatic activity/volume] in Serum or Plasma', loinc: '1920-8' },
      { short: 'ALT', full: 'Alanine Aminotransferase', longCommonName: 'Alanine aminotransferase [Enzymatic activity/volume] in Serum or Plasma', loinc: '1742-6' },
      { short: 'GGT', full: 'Gamma Glutamyltransferase', longCommonName: 'Gamma glutamyl transferase [Enzymatic activity/volume] in Serum or Plasma', loinc: '2324-2' },
      { short: 'PCHE', full: 'Pseudocholinesterase', longCommonName: 'Cholinesterase [Enzymatic activity/volume] in Serum or Plasma', loinc: '2710-2' },
      { short: 'HBsAg', full: 'Hepatitis B Surface Antigen', longCommonName: 'Hepatitis B virus surface Ag [Presence] in Serum', loinc: '5195-3' },
      { short: 'HCV', full: 'Hepatitis C Antibody', longCommonName: 'Hepatitis C virus Ab [Presence] in Serum', loinc: '16128-1' },
      { short: 'ALB', full: 'Albumin', longCommonName: 'Albumin [Mass/volume] in Serum or Plasma', loinc: '1751-7' },
      { short: 'GLOB', full: 'Globulin', longCommonName: 'Globulin [Mass/volume] in Serum by calculation', loinc: '10834-0' },
      { short: 'TP', full: 'Total Protein', longCommonName: 'Total protein [Mass/volume] in Serum or Plasma', loinc: '2885-2' },
    ],
  },
  {
    name: 'Kidney Function',
    tests: [
      { short: 'BUN', full: 'Urea', longCommonName: 'Urea nitrogen [Mass/volume] in Serum or Plasma', loinc: '3094-0' },
      { short: 'CREA', full: 'Creatinine', longCommonName: 'Creatinine [Mass/volume] in Serum or Plasma', loinc: '12190-5' },
      { short: 'UA', full: 'Uric Acid', longCommonName: 'Urate [Mass/volume] in Serum or Plasma', loinc: '3084-1' },
      { short: 'eGFR', full: 'eGFR', longCommonName: 'Glomerular filtration rate/1.73 sq M.predicted [Volume Rate/Area] in Serum or Plasma', loinc: '48642-3' },
      { short: 'CYSC', full: 'Cystatin C', longCommonName: 'Cystatin C [Mass/volume] in Serum or Plasma', loinc: '33863-2' },
    ],
  },
  {
    name: 'Anemia',
    tests: [
      { short: 'RBC', full: 'Red Blood Cells', longCommonName: 'Erythrocytes [#/volume] in Blood by Automated count', loinc: '789-8' },
      { short: 'HGB', full: 'Hemoglobin', longCommonName: 'Hemoglobin [Mass/volume] in Blood', loinc: '718-7' },
      { short: 'HCT', full: 'Hematocrit', longCommonName: 'Hematocrit [Volume Fraction] of Blood by Automated count', loinc: '4544-3' },
      { short: 'FE', full: 'Iron Serum', longCommonName: 'Iron [Mass/volume] in Serum or Plasma', loinc: '2498-4' },
      { short: 'FERR', full: 'Ferritin', longCommonName: 'Ferritin [Mass/volume] in Serum or Plasma', loinc: '2276-4' },
      { short: 'TIBC', full: 'Total Iron Binding Capacity', longCommonName: 'Iron binding capacity [Mass/volume] in Serum or Plasma', loinc: '2500-7' },
      { short: 'UIBC', full: 'Unsaturated Iron-Binding Capacity', longCommonName: 'Iron binding capacity.unsaturated [Mass/volume] in Serum or Plasma', loinc: '2501-5' },
      { short: 'TRF', full: 'Transferrin', longCommonName: 'Transferrin [Mass/volume] in Serum or Plasma', loinc: '3034-6' },
      { short: 'TSAT', full: '% Iron Saturation', longCommonName: 'Iron saturation [Mass Fraction] in Serum or Plasma', loinc: '2502-3' },
    ],
  },
  {
    name: 'Bone and Mineral Metabolism',
    tests: [
      { short: 'B1', full: 'Vitamin B1 (Thiamine)', longCommonName: 'Thiamine [Mass/volume] in Blood', loinc: '32700-7' },
      { short: 'B6', full: 'Vitamin B6 (Pyridoxal-5-Phosphate)', longCommonName: 'Pyridoxal phosphate [Mass/volume] in Plasma', loinc: '2842-3' },
      { short: 'B9', full: 'Vitamin B9 (Folate)', longCommonName: 'Folate [Mass/volume] in Serum or Plasma', loinc: '2284-8' },
      { short: 'B12', full: 'Vitamin B12 (Cobalamin)', longCommonName: 'Cobalamin [Mass/volume] in Serum or Plasma', loinc: '2132-9' },
      { short: '25OH', full: 'Vitamin D (25-OH)', longCommonName: '25-Hydroxyvitamin D [Mass/volume] in Serum or Plasma', loinc: '1989-3' },
      { short: 'CA', full: 'Calcium', longCommonName: 'Calcium [Mass/volume] in Serum or Plasma', loinc: '17861-6' },
      { short: 'ICA', full: 'Ionized Calcium', longCommonName: 'Calcium.ionized [Moles/volume] in Serum or Plasma', loinc: '1994-3' },
      { short: 'CL', full: 'Chloride', longCommonName: 'Chloride [Moles/volume] in Serum or Plasma', loinc: '2075-0' },
      { short: 'PHOS', full: 'Phosphorus', longCommonName: 'Phosphate [Mass/volume] in Serum or Plasma', loinc: '2777-1' },
      { short: 'K+', full: 'Potassium', longCommonName: 'Potassium [Moles/volume] in Serum or Plasma', loinc: '2823-3' },
      { short: 'MG', full: 'Magnesium', longCommonName: 'Magnesium [Mass/volume] in Serum or Plasma', loinc: '19123-9' },
      { short: 'MGRBC', full: 'Magnesium RBC', longCommonName: 'Magnesium [Mass/volume] in Red Blood Cells', loinc: '29900-7' },
      { short: 'NA', full: 'Sodium', longCommonName: 'Sodium [Moles/volume] in Serum or Plasma', loinc: '2950-4' },
      { short: 'ZN', full: 'Zinc', longCommonName: 'Zinc [Mass/volume] in Serum or Plasma', loinc: '35937' },
      { short: 'PTH', full: 'Parathyroid Hormone', longCommonName: 'Parathyrin.intact [Mass/volume] in Serum or Plasma', loinc: '2731-8' },
    ],
  },
  {
    name: 'Pancreatic Function',
    tests: [
      { short: 'AMY', full: 'Amylase', longCommonName: 'Amylase [Enzymatic activity/volume] in Serum or Plasma', loinc: '1798-8' },
      { short: 'LIP', full: 'Lipase', longCommonName: 'Lipase [Enzymatic activity/volume] in Serum or Plasma', loinc: '3040-3' },
    ],
  },
];

type PopupState = { test: Observation; top: number; left: number };

export function MedicalConditionsPage() {
  const [popup, setPopup] = useState<PopupState | null>(null);

  const openPopup = (test: Observation, e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPopup({ test, top: rect.bottom + 8, left: rect.left + rect.width / 2 });
  };

  return (
    <div style={{ padding: '56px 64px', maxWidth: 1120, margin: '0 auto' }}>
      <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 32 }}>Monitoring Panels</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 40 }}>
        {CONDITIONS.map((condition) => (
          <div
            key={condition.name}
            style={{
              border: '1.5px solid #1971c2',
              borderRadius: 16,
              padding: 20,
              boxSizing: 'border-box',
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                marginBottom: 16,
              }}
            >
              {condition.name}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
              {condition.tests.map((test) => (
                <div
                  key={test.short}
                  onClick={(e) => openPopup(test, e)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: 40,
                    border: '1.5px solid #1971c2',
                    borderRadius: 9999,
                    fontSize: 14,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    boxSizing: 'border-box',
                    cursor: 'pointer',
                  }}
                >
                  {test.short}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {popup && (
        <>
          <div onClick={() => setPopup(null)} style={{ position: 'fixed', inset: 0, zIndex: 100 }} />
          <div
            style={{
              position: 'fixed',
              top: popup.top,
              left: popup.left,
              transform: 'translateX(-50%)',
              background: '#fff',
              border: '1.5px solid #1971c2',
              borderRadius: 12,
              padding: 18,
              width: 260,
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
              boxSizing: 'border-box',
              zIndex: 101,
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
              {popup.test.full}
              {popup.test.full !== popup.test.short && ` (${popup.test.short})`}
            </div>
            <div style={{ fontSize: 13, color: '#555' }}>
              <a
                href={`https://loinc.org/${popup.test.loinc}`}
                target="_blank"
                rel="noreferrer"
                style={{ fontFamily: 'monospace', color: '#1971c2' }}
              >
                {popup.test.loinc}
              </a>{' '}
              {popup.test.longCommonName}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
