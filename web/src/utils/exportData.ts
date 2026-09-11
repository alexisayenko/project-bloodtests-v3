import type { Result, DiagnosticReport as DiagnosticReportType } from '../types';
import type { EnvelopeMeta } from '../data/envelopeMeta';
import { SCHEMA_VERSION } from '../data/envelopeSchema';
import { ucumUnitFor } from '../data/unitNormalization';
import type {
  InterchangeEnvelope,
  InterchangeObservation,
  InterchangeReferenceRange,
  InterchangeReport,
} from '../data/envelopeTypes';

/** `generatedAt` is optional in the format but this exporter always stamps it. */
type StampedEnvelope = InterchangeEnvelope & { generatedAt: string };

function resultToObservation(result: Result): InterchangeObservation {
  const obs: InterchangeObservation = {
    loinc: result.loinc,
    rawName: result.rawName || 'Unknown Test',
  };

  if (result.value !== null) {
    obs.value = result.value;
  }

  if (result.rawValue) {
    obs.rawValue = result.rawValue;
  }

  // `unit` is ours, `rawUnit` is the report's: the printed spelling is folded to
  // its UCUM code and written to `unit`, and the string the lab printed goes to
  // `rawUnit` untouched. Only the spelling is normalized — no value is
  // converted (ADR-0003) — so the number beside it still means what it did.
  // A unit the curated tables cannot place leaves `unit` ABSENT rather than
  // filled with the printed string: the field would otherwise claim a
  // normalization that did not happen. `rawUnit` still carries it, and the
  // validator already flags such a row.
  if (result.unit) {
    const ucum = ucumUnitFor(result.unit);
    if (ucum) {
      obs.unit = ucum;
    }
    obs.rawUnit = result.unit;
  }

  if (result.refMin !== null || result.refMax !== null) {
    const range: InterchangeReferenceRange = {
      ...(result.refMin !== null && { low: result.refMin }),
      ...(result.refMax !== null && { high: result.refMax }),
      ...(result.refText && { text: result.refText }),
    };
    obs.referenceRanges = [range];
  }

  if (result.method) {
    obs.method = result.method;
  }

  return obs;
}

async function computeSha256Hash(data: InterchangeReport[]): Promise<string> {
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
): Promise<StampedEnvelope> {
  const diagnosticReports: InterchangeReport[] = sessions
    .filter((session) => session.items && session.items.length > 0)
    .map((session) => ({
      lab: session.place || 'Unknown Lab',
      collectedAt: `${session.date}T00:00:00Z`,
      observations: (session.items || []).map(resultToObservation),
    }));

  const contentHash = await computeSha256Hash(diagnosticReports);

  const envelope: StampedEnvelope = {
    schema: SCHEMA_VERSION,
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

export function downloadExportFile(envelope: InterchangeEnvelope): void {
  const jsonString = JSON.stringify(envelope, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const now = new Date();
  const dateStr = now.toISOString().split('T')[0].replaceAll('-', '');
  const filename = `blood-tests-export-${dateStr}.json`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function exportData(sessions: DiagnosticReportType[], meta?: EnvelopeMeta): Promise<string> {
  const envelope = await buildExportEnvelope(sessions, meta);
  downloadExportFile(envelope);
  return envelope.generatedAt;
}
