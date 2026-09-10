import { COLOR } from '../../styles/tokens';
// A placeholder: the section ships empty on purpose, because its data model
// and storage are still undecided (task-0018).
export function MedicationsView() {
  return (
    <>
      <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 8 }}>Medications</h1>
      <div style={{ color: COLOR.textMuted, fontSize: 14 }}>
        Medication history — what was taken and at what dosage, month by month — is planned.
      </div>
    </>
  );
}
