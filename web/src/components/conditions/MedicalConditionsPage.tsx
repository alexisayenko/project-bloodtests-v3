const CONDITIONS = [
  {
    name: 'Hypogonadism',
    tests: [
      'Testosterone (T)',
      'Testosterone, Free (FT)',
      'Luteinizing Hormone (LH)',
      'Follicle Stimulating Hormone (FSH)',
      'Total Prolactin (PRL)',
      'SHBG',
      'Estradiol (E2)',
      'Dihydrotestosterone (DHT)',
      'DHEA-S',
    ],
  },
  {
    name: 'Hypothyroidism',
    tests: ['TSH', 'Free T3 (FT3)', 'Free T4 (FT4)', 'Anti-TPO', 'Anti-TG', 'TRAb', 'Calcitonin (CT)'],
  },
  {
    name: 'Insulin Resistance',
    tests: [
      'Insulin',
      'Glucose Serum',
      'HbA1c (NGSP)',
      'HbA1c (IFCC)',
      'Glycated Albumin (GA)',
      'Fructosamine',
      'C-Peptide',
      'Amylase',
      'Lipase',
    ],
  },
];

export function MedicalConditionsPage() {
  return (
    <div style={{ padding: '56px 64px', maxWidth: 1120, margin: '0 auto' }}>
      <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 32 }}>Medical Conditions</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 40 }}>
        {CONDITIONS.map((condition) => (
          <div key={condition.name}>
            <div
              style={{
                fontSize: 18,
                fontWeight: 600,
                paddingBottom: 14,
                borderBottom: '2px solid #1971c2',
                marginBottom: 4,
              }}
            >
              {condition.name}
            </div>
            {condition.tests.map((test, i) => (
              <div
                key={test}
                style={{
                  padding: '12px 2px',
                  fontSize: 15,
                  borderBottom: i < condition.tests.length - 1 ? '1px solid #e9ecef' : 'none',
                }}
              >
                {test}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
