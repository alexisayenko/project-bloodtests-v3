import type { DiagnosticReport } from '../types';
import { parseUploadedResults } from './parseUpload';
import { filesFromUpload, patchEditedFile, resolveReportFiles } from './reportFiles';
import { loadHeldFiles, saveHeldFiles, withPending } from './storage/heldFiles';
import { RESULTS_STORAGE_KEY } from './storage/resultsStorage';

// The parsed sessions are the display model; the stored files behind them (held next to them, keyed by
// each session's `source`) are what export and sync send (ADR-0028). Every change goes through `commit`.
// A change the user makes also records which files it touched (`pending`): sync sends those and no others.

const byDateDesc = (sessions: DiagnosticReport[]) => [...sessions].sort((a, b) => b.date.localeCompare(a.date));

type Touched = { paths?: string[]; sessions?: string[] };

function commit(sessions: DiagnosticReport[], reports: Record<string, string>, now: Date, touched?: Touched): DiagnosticReport[] {
  const resolved = resolveReportFiles(byDateDesc(sessions), reports, now);
  const previous = loadHeldFiles();
  const held = { ...previous, reports: resolved.files };
  if (touched) {
    const ofSessions = resolved.sessions.flatMap((s) => (touched.sessions?.includes(s.file) && s.source ? [s.source.path] : []));
    const removed = Object.keys(previous.reports).filter((path) => !(path in resolved.files));
    saveHeldFiles(withPending(held, { reports: [...(touched.paths ?? []), ...ofSessions], removed }));
  } else {
    saveHeldFiles(held);
  }
  localStorage.setItem(RESULTS_STORAGE_KEY, JSON.stringify(resolved.sessions));
  return resolved.sessions;
}

function sessionsOfFiles(files: Record<string, string>): DiagnosticReport[] {
  return Object.entries(files).flatMap(([path, text]) => parseUploadedResults(JSON.parse(text), path));
}

// The stored file is the truth, the persisted session only a cache of its parse: a session saved by an
// earlier build lacks whatever fields the parse has gained since (`storedUnit`), so it is read again.
function rereadFromHeldFile(session: DiagnosticReport, held: Record<string, string>): DiagnosticReport {
  const { source } = session;
  const text = source ? held[source.path] : undefined;
  if (!source || text === undefined) return session;
  try {
    const fresh = parseUploadedResults(JSON.parse(text), source.path).find((s) => s.source?.index === source.index);
    return fresh && fresh.file === session.file && JSON.stringify(fresh) !== JSON.stringify(session) ? fresh : session;
  } catch {
    return session;
  }
}

/** Stored sessions that no held file backs (older builds, generated data) get one built, once. */
export function settleStoredSessions(sessions: DiagnosticReport[], now = new Date()): DiagnosticReport[] {
  const held = loadHeldFiles().reports;
  if (sessions.length === 0 && Object.keys(held).length === 0) return sessions;
  const reread = sessions.map((session) => rereadFromHeldFile(session, held));
  const resolved = resolveReportFiles(reread, held, now);
  const changed = resolved.sessions.some((s, i) => s !== sessions[i]) || Object.keys(resolved.files).length !== Object.keys(held).length;
  if (!changed) return sessions;
  try {
    return commit(resolved.sessions, resolved.files, now);
  } catch {
    return resolved.sessions;
  }
}

/** Backup zip or cloud pull: the files are held exactly as they came in. Replaces everything stored. */
export function replaceReportFiles(files: Record<string, string>, now = new Date(), touched?: Touched): DiagnosticReport[] {
  return commit(sessionsOfFiles(files), files, now, touched);
}

// A throwing parse leaves the previous sessions untouched, a successful one wipes them.
export function importResults(json: unknown, text?: string, now = new Date()): DiagnosticReport[] {
  parseUploadedResults(json);
  const files = filesFromUpload(json as Record<string, unknown>, text, new Set(), now);
  return replaceReportFiles(files, now, { paths: Object.keys(files) });
}

/** A same-id session is replaced, so its file is freed for the new one. */
export function addResults(
  current: DiagnosticReport[],
  json: unknown,
  text?: string,
  now = new Date()
): { sessions: DiagnosticReport[]; added: number } {
  const incomingIds = new Set(parseUploadedResults(json).map((s) => s.file));
  const kept = current.filter((s) => !incomingIds.has(s.file));
  const reports = loadHeldFiles().reports;
  const stillUsed = new Set(kept.flatMap((s) => (s.source ? [s.source.path] : [])));
  const taken = new Set(Object.keys(reports).filter((path) => stillUsed.has(path)));
  const files = filesFromUpload(json as Record<string, unknown>, text, taken, now);
  const incoming = sessionsOfFiles(files);
  const sessions = commit([...kept, ...incoming], { ...reports, ...files }, now, { paths: Object.keys(files) });
  return { sessions, added: incoming.length };
}

/** Sessions with no stored file yet (generated test data) are merged in by id and given one. */
export function addSessions(current: DiagnosticReport[], incoming: DiagnosticReport[], now = new Date()): DiagnosticReport[] {
  const byFile = new Map(current.map((s) => [s.file, s]));
  for (const s of incoming) byFile.set(s.file, s);
  return commit([...byFile.values()], loadHeldFiles().reports, now, { sessions: incoming.map((s) => s.file) });
}

/** Only the edited observation fields of the stored file change; the file is stamped `lastUpdatedDate`. */
export function editSession(current: DiagnosticReport[], file: string, updated: DiagnosticReport, now = new Date()): DiagnosticReport[] {
  const previous = current.find((s) => s.file === file);
  const reports = { ...loadHeldFiles().reports };
  const source = previous?.source;
  if (previous && source && reports[source.path] !== undefined) {
    reports[source.path] = patchEditedFile(reports[source.path], source.index, previous.items ?? [], updated.items ?? [], now);
  }
  const edited = { ...updated, ...(source && { source }) };
  return commit(current.map((s) => (s.file === file ? edited : s)), reports, now, { sessions: [file] });
}

export function clearStoredResults(): void {
  try {
    saveHeldFiles({ ...loadHeldFiles(), reports: {} });
    localStorage.removeItem(RESULTS_STORAGE_KEY);
  } catch {
    // storage unavailable
  }
}
