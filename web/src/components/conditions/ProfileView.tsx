import type { DiagnosticReport } from '../../types';
import { generateTestDataThen } from '../../data/generateTestData';
import { Shield, Upload, Sparkles } from 'lucide-react';
import { PageHeader } from './PageHeader';
import { Button, FileButton } from '../primitives';
import { COLOR } from '../../styles/tokens';

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
  onGenerated,
}: Readonly<{
  sessionCount: number;
  uploadError: string | null;
  uploadFile: (file: File) => Promise<void>;
  loadGenerated: (groups: DiagnosticReport[]) => void;
  /** Re-reads what the generator may have written straight to storage (the schedule). */
  onStoredStateChanged: () => void;
  /** Runs once generation has finished, to show the result. */
  onGenerated: () => void;
}>) {
  return (
    <>
      <PageHeader
        overline="Local-First Health Vault"
        titlePrimary="Get"
        titleAccent="Started"
        description={[
          'A LOINC-coded blood-test monitoring tool. Upload a lab-results export and it is organized into monitoring panels by condition and organ system.',
          'All processing occurs locally in your browser — client-side persistence, zero server transmission, and evidence-graded reference ranges.',
        ]}
        pillars={[
          { icon: Shield, line1: '100% private', line2: 'client-side only' },
          { icon: Upload, line1: 'JSON import,', line2: 'PDFs via a chatbot' },
          { icon: Sparkles, line1: 'Evidence-graded', line2: 'clinical indices' },
        ]}
      />

      <div>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Want a demo first?</h2>
        <div style={{ color: COLOR.textMuted, fontSize: 14, marginBottom: 12 }}>
          Add 16 sample lab reports from five labs and 5 medications — the reports merge with whatever is already
          loaded ({sessionCount} report{sessionCount === 1 ? '' : 's'} currently), medications you already list keep
          their entries, and a sample schedule is set only if nothing is scheduled yet.
        </div>
        <Button onClick={() => generateTestDataThen(loadGenerated, [onStoredStateChanged, onGenerated])}>Generate Test Data</Button>
      </div>

      <div style={SECTION_DIVIDER}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Import your diagnostic reports database.</h2>
        <div style={{ color: COLOR.textMuted, fontSize: 14, marginBottom: 12 }}>
          Import it — it replaces whatever is currently loaded ({sessionCount} report{sessionCount === 1 ? '' : 's'}{' '}
          currently).
        </div>
        <FileButton variant="primary" accept=".json,application/json" onFile={uploadFile}>
          Import JSON
        </FileButton>
        {uploadError && <div style={{ color: COLOR.statusBadText, fontSize: 14, marginTop: 12 }}>{uploadError}</div>}
      </div>

      <div style={SECTION_DIVIDER}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Don't have one?</h2>
        <div style={{ color: COLOR.textMuted, fontSize: 14, marginBottom: 12 }}>
          Create one starting from adding your first diagnostic report.
        </div>
        <Button onClick={goToReports}>Go to Diagnostic Reports</Button>
      </div>
    </>
  );
}
