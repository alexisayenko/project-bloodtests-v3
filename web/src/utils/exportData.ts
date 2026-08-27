import type { Result, DiagnosticReport as DiagnosticReportType } from '../types';
import type { EnvelopeMeta } from '../data/envelopeMeta';

interface DiagnosticReportObservation {
  loinc: string;
  name: string;
  value?: number;
  unit?: string;
  referenceRanges?: Array<{
    low?: number;
    high?: number;
    text?: string;
    label?: string;
  }>;
  interpretation?: string;
  method?: string;
  rawValue?: string;
}

interface DiagnosticReport {
  lab: string;
  collectedAt: string;
  observations: DiagnosticReportObservation[];
}

interface ExportEnvelope {
  schema: 1;
  generatedAt: string;
  contentHash: string;
  subject?: string;
  sex?: string;
  birthYear?: number;
  notes?: string;
  diagnosticReports: DiagnosticReport[];
}

function resultToObservation(result: Result): DiagnosticReportObservation {
  const obs: DiagnosticReportObservation = {
    loinc: result.loinc,
    name: result.analysis || 'Unknown Test',
  };

  if (result.value !== null) {
    obs.value = result.value;
  }

  if (result.rawValue) {
    obs.rawValue = result.rawValue;
  }

  if (result.unit) {
    obs.unit = result.unit;
  }

  if (result.refMin !== null || result.refMax !== null) {
    obs.referenceRanges = [
      {
        ...(result.refMin !== null && { low: result.refMin }),
        ...(result.refMax !== null && { high: result.refMax }),
        ...(result.refText && { text: result.refText }),
      },
    ];
  }

  if (result.method) {
    obs.method = result.method;
  }

  return obs;
}

async function computeSha256Hash(data: DiagnosticReport[]): Promise<string> {
  const jsonString = JSON.stringify(data);
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(jsonString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);

  // Convert to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  return `sha256:${hashHex}`;
}

export async function buildExportEnvelope(
  sessions: DiagnosticReportType[],
  meta?: EnvelopeMeta
): Promise<ExportEnvelope> {
  const diagnosticReports: DiagnosticReport[] = sessions
    .filter((session) => session.items && session.items.length > 0)
    .map((session) => ({
      lab: session.place || 'Unknown Lab',
      collectedAt: `${session.date}T00:00:00Z`,
      observations: (session.items || []).map(resultToObservation),
    }));

  const contentHash = await computeSha256Hash(diagnosticReports);

  const envelope: ExportEnvelope = {
    schema: 1,
    generatedAt: new Date().toISOString(),
    contentHash,
    diagnosticReports,
  };

  if (meta?.subject?.trim()) {
    envelope.subject = meta.subject.trim();
  }

  if (meta?.sex) {
    envelope.sex = meta.sex;
  }

  if (meta?.birthYear) {
    envelope.birthYear = meta.birthYear;
  }

  if (meta?.notes?.trim()) {
    envelope.notes = meta.notes.trim();
  }

  return envelope;
}

export function downloadExportFile(envelope: ExportEnvelope): void {
  const jsonString = JSON.stringify(envelope, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const now = new Date();
  const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
  const filename = `blood-tests-export-${dateStr}.json`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportData(sessions: DiagnosticReportType[], meta?: EnvelopeMeta): Promise<string> {
  const envelope = await buildExportEnvelope(sessions, meta);
  downloadExportFile(envelope);
  return envelope.generatedAt;
}
