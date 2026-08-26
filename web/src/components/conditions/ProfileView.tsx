import { generateTestData } from '../../data/generateTestData';
import { pressable } from './ui';

const ACTION = {
  display: 'inline-block',
  padding: '8px 20px',
  borderRadius: 9999,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
} as const;

export function ProfileView({
  sessionCount,
  uploadError,
  uploadFile,
  loadGenerated,
  clearData,
}: Readonly<{
  sessionCount: number;
  uploadError: string | null;
  uploadFile: (file: File) => Promise<void>;
  loadGenerated: (groups: ReturnType<typeof generateTestData>) => void;
  clearData: () => void;
}>) {
  return (
    <>
      <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 8 }}>Get Started</h1>
      <div style={{ color: '#888', fontSize: 14, marginBottom: 12 }}>
        A LOINC-coded blood-test monitoring tool. Upload a lab-results export and it is organized into monitoring
        panels by condition and organ system, tracked over time against reference ranges and computed indices.
      </div>
      <div style={{ color: '#888', fontSize: 14, marginBottom: 12 }}>
        All processing occurs locally, within this browser. Uploaded results are parsed client-side and persisted
        only to this device's local storage; no data is transmitted to, or retained by, any server.
      </div>
      <div style={{ color: '#888', fontSize: 14, marginBottom: 24 }}>
        Every reference range and computed index is sourced from a cited paper or clinical guideline, and labeled
        by how strong that evidence is: <b>guideline</b> (a professional-society standard), <b>consensus</b> (a
        widely used but secondary source), or <b>heuristic</b> (orientation only — no validated cutoff).
      </div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <label style={{ ...ACTION, border: '1.5px solid #1971c2', background: '#1971c2', color: '#fff' }}>
          {'Upload JSON'}
          <input
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadFile(file);
              e.target.value = '';
            }}
          />
        </label>
        <div
          {...pressable(() => loadGenerated(generateTestData()))}
          style={{ ...ACTION, border: '1.5px solid #1971c2', color: '#1971c2' }}
        >
          Generate Test Data
        </div>
        <div
          {...pressable(() => {
            if (window.confirm('Remove all loaded lab reports?')) clearData();
          })}
          style={{ ...ACTION, border: '1.5px solid #ea4335', color: '#ea4335' }}
        >
          Clear
        </div>
      </div>
      {uploadError && <div style={{ color: '#ea4335', fontSize: 14, marginBottom: 12 }}>{uploadError}</div>}
      <div style={{ color: '#888', fontSize: 14 }}>
        Upload a lab-results JSON export, or add 6 randomly generated lab reports. Both merge with whatever is
        already loaded ({sessionCount} report{sessionCount === 1 ? '' : 's'} currently).
      </div>
    </>
  );
}
