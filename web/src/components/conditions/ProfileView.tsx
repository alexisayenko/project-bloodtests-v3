import type { DiagnosticReport } from '../../types';
import { applyTestData } from '../../data/generateTestData';
import { pressable } from './ui';
import { COLOR } from '../../styles/tokens';

const ACTION = {
  display: 'inline-block',
  padding: '8px 20px',
  borderRadius: 9999,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
} as const;

const SECTION_DIVIDER = {
  borderTop: `1px solid ${COLOR.borderSubtle}`,
  marginTop: 24,
  paddingTop: 20,
} as const;

function goToReports() {
  window.history.pushState(null, '', '#reports');
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function ProfileView({
  sessionCount,
  uploadError,
  uploadFile,
  loadGenerated,
  onStoredStateChanged,
}: Readonly<{
  sessionCount: number;
  uploadError: string | null;
  uploadFile: (file: File) => Promise<void>;
  loadGenerated: (groups: DiagnosticReport[]) => void;
  /** Re-reads what the generator may have written straight to storage (the schedule). */
  onStoredStateChanged: () => void;
}>) {
  return (
    <>
      <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 8 }}>Get Started</h1>
      <div style={{ color: COLOR.textMuted, fontSize: 14, marginBottom: 12 }}>
        A LOINC-coded blood-test monitoring tool. Upload a lab-results export and it is organized into monitoring
        panels by condition and organ system, tracked over time against reference ranges and computed indices.
      </div>
      <div style={{ color: COLOR.textMuted, fontSize: 14, marginBottom: 12 }}>
        All processing occurs locally, within this browser. Uploaded results are parsed client-side and persisted
        only to this device's local storage; no data is transmitted to, or retained by, any server.
      </div>
      <div style={{ color: COLOR.textMuted, fontSize: 14, marginBottom: 24 }}>
        Every reference range and computed index is sourced from a cited paper or clinical guideline, and labeled
        by how strong that evidence is: <b>guideline</b> (a professional-society standard), <b>consensus</b> (a
        widely used but secondary source), or <b>heuristic</b> (orientation only — no validated cutoff).
      </div>

      <div>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Import your diagnostic reports database.</h2>
        <div style={{ color: COLOR.textMuted, fontSize: 14, marginBottom: 12 }}>
          Import it — it replaces whatever is currently loaded ({sessionCount} report{sessionCount === 1 ? '' : 's'}{' '}
          currently).
        </div>
        <label style={{ ...ACTION, border: `1.5px solid ${COLOR.accent}`, background: COLOR.accent, color: COLOR.textOnAccent }}>
          {'Import JSON'}
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
        {uploadError && <div style={{ color: COLOR.statusBad, fontSize: 14, marginTop: 12 }}>{uploadError}</div>}
      </div>

      <div style={SECTION_DIVIDER}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Don't have one?</h2>
        <div style={{ color: COLOR.textMuted, fontSize: 14, marginBottom: 12 }}>
          Create one starting from adding your first diagnostic report.
        </div>
        <div {...pressable(goToReports)} style={{ ...ACTION, border: `1.5px solid ${COLOR.accent}`, color: COLOR.accent }}>
          Go to Diagnostic Reports
        </div>
      </div>

      <div style={SECTION_DIVIDER}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Want a demo first?</h2>
        <div style={{ color: COLOR.textMuted, fontSize: 14, marginBottom: 12 }}>
          Add 15 sample lab reports from four labs and 5 medications — the reports merge with whatever is already
          loaded ({sessionCount} report{sessionCount === 1 ? '' : 's'} currently), medications you already list keep
          their entries, and a sample schedule is set only if nothing is scheduled yet.
        </div>
        <div
          {...pressable(() => {
            applyTestData(loadGenerated);
            onStoredStateChanged();
          })}
          style={{ ...ACTION, border: `1.5px solid ${COLOR.accent}`, color: COLOR.accent }}
        >
          Generate Test Data
        </div>
      </div>
    </>
  );
}
