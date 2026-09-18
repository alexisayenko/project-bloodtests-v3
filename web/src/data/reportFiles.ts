import { SCHEMA_VERSION } from './envelopeSchema';
import type { InterchangeReport } from './envelopeTypes';
import { computeSha256Hash } from '../utils/exportData';

const REPORTS_PREFIX = 'reports/';
const META_FIELDS = ['subject', 'sex', 'birthYear', 'notes'] as const;
const FILE_NAME = /^reports\/(\d{4}-\d{2}-\d{2}|unknown)__(.*)\.json$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseObject(text: string, what: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`${what} is not valid JSON.`);
  }
  if (!isRecord(parsed)) throw new Error(`${what} is not an object.`);
  return parsed;
}

function labSlug(lab: unknown): string {
  const slug = typeof lab === 'string' ? lab.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-').replaceAll(/^-+|-+$/g, '') : '';
  return slug || 'lab';
}

function reportDate(collectedAt: unknown): string {
  const date = typeof collectedAt === 'string' ? collectedAt.slice(0, 10) : '';
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : 'unknown';
}

function fileText(value: unknown): string {
  return JSON.stringify(value, null, 2) + '\n';
}

export async function splitReportsToFiles(labReportsJson: string): Promise<Record<string, string>> {
  const envelope = parseObject(labReportsJson, 'lab-reports.json');
  const reports = envelope.diagnosticReports;
  if (!Array.isArray(reports)) throw new Error('lab-reports.json has no diagnosticReports.');

  const groups = new Map<string, InterchangeReport[]>();
  for (const report of reports as InterchangeReport[]) {
    const base = `${reportDate(report?.collectedAt)}__${labSlug(report?.lab)}`;
    const group = groups.get(base);
    if (group) group.push(report);
    else groups.set(base, [report]);
  }

  const meta: Record<string, unknown> = {};
  for (const field of META_FIELDS) if (envelope[field] !== undefined) meta[field] = envelope[field];
  const schema = envelope.schema ?? SCHEMA_VERSION;

  const named: [string, InterchangeReport][] = [];
  const used = new Set<string>();
  for (const [base, group] of groups) {
    group.forEach((report, index) => {
      let n = index + 1;
      let name = n === 1 ? `${base}.json` : `${base}-${n}.json`;
      while (used.has(name)) name = `${base}-${++n}.json`;
      used.add(name);
      named.push([name, report]);
    });
  }
  named.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  const files: Record<string, string> = {};
  for (const [name, report] of named) {
    files[REPORTS_PREFIX + name] = fileText({
      schema,
      contentHash: await computeSha256Hash([report]),
      diagnosticReports: [report],
      ...meta,
    });
  }
  return files;
}

type ParsedFile = { date: string; slug: string; n: number; envelope: Record<string, unknown> };

function parseFile(key: string, text: string): ParsedFile {
  const match = FILE_NAME.exec(key);
  const stem = match?.[2] ?? key;
  const suffix = /^(.*?)-(\d+)$/.exec(stem);
  return {
    date: match?.[1] ?? 'unknown',
    slug: suffix ? suffix[1] : stem,
    n: suffix ? Number(suffix[2]) : 1,
    envelope: parseObject(text, key),
  };
}

function compareFiles(a: ParsedFile, b: ParsedFile): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  if (a.slug !== b.slug) return a.slug < b.slug ? -1 : 1;
  return a.n - b.n;
}

/** Newest date first, then lab slug, then suffix. Null when the folder holds no report file. */
export async function mergeFilesToLabReports(files: Record<string, string>): Promise<string | null> {
  const parsed = Object.keys(files)
    .filter((key) => key.startsWith(REPORTS_PREFIX) && key.endsWith('.json'))
    .map((key) => parseFile(key, files[key]))
    .sort(compareFiles);
  if (parsed.length === 0) return null;

  const diagnosticReports: unknown[] = [];
  const meta: Record<string, unknown> = {};
  let schema: unknown;
  let generatedAt: string | undefined;
  for (const { envelope } of parsed) {
    schema ??= envelope.schema;
    if (typeof envelope.generatedAt === 'string' && (generatedAt === undefined || envelope.generatedAt > generatedAt)) {
      generatedAt = envelope.generatedAt;
    }
    for (const field of META_FIELDS) if (meta[field] === undefined && envelope[field] !== undefined) meta[field] = envelope[field];
    if (Array.isArray(envelope.diagnosticReports)) diagnosticReports.push(...envelope.diagnosticReports);
  }

  return JSON.stringify(
    {
      schema: schema ?? SCHEMA_VERSION,
      ...(generatedAt !== undefined && { generatedAt }),
      contentHash: await computeSha256Hash(diagnosticReports as InterchangeReport[]),
      diagnosticReports,
      ...meta,
    },
    null,
    2
  );
}
