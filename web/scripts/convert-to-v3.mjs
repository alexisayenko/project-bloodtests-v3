import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020Module from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';

const Ajv2020 = Ajv2020Module.default ?? Ajv2020Module;
const addFormats = addFormatsModule.default ?? addFormatsModule;

const here = dirname(fileURLToPath(import.meta.url));
const schemaPath = resolve(here, '../public/schema/bloodtests-3.schema.json');

// The converter's OUTPUT stamp: the current "major.minor" string. Its INPUT
// side is wider — the legacy numbers 1 and 3, and any "3.x" string — because
// it has to go on reading every file the app has ever written.
const SCHEMA_MAJOR = 3;
const SCHEMA_VERSION = `${SCHEMA_MAJOR}.1`;
const MINOR_VERSION_RE = new RegExp(`^${SCHEMA_MAJOR}\\.(0|[1-9][0-9]*)$`);
const isCurrentMajor = (v) => v === SCHEMA_MAJOR || (typeof v === 'string' && MINOR_VERSION_RE.test(v));
const isAcceptedEnvelopeVersion = (v) => v === 1 || isCurrentMajor(v);
const COMPARATORS = new Set(['<', '<=', '>=', '>']);
const META_KEYS = ['subject', 'sex', 'birthYear', 'notes'];
const RESTAMPED_KEYS = new Set(['schema', 'generatedAt', 'contentHash', 'diagnosticReports']);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const V2_LOINC_RE = /^\d+-\d$/;

const USAGE = `Usage: node scripts/convert-to-v3.mjs <input.json> [-o output.json] [--force]

Upgrades a legacy blood-tests file to the v3 interchange envelope
(schema "${SCHEMA_VERSION}"), the only shape the app reads. An observation's printed
test name is written to "rawName"; a source file carrying it under "name" is
renamed on the way out.

Accepted input shapes:
  - v3 envelope stamped schema 1
  - v3 envelope stamped any 3.x version, or the legacy number 3
    (restamped "${SCHEMA_VERSION}"; copied through unchanged when it already is)
  - canonical draws (project-bloodtests-v2): [{ date, labName, sourceFile?, items }]
  - flat entries (legacy): [{ date, place?, analysis, loinc, value, ... }]
  - grouped sessions (legacy): [{ date, place, items }]

Options:
  -o, --output <path>  Output file (default: <input>.v3.json beside the input)
      --force          Overwrite an existing output file
  -h, --help           Show this message`;

class ConversionError extends Error {}

function parseArgs(argv) {
  let input = null;
  let output = null;
  let force = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') return { help: true };
    if (arg === '-o' || arg === '--output') {
      i += 1;
      if (!argv[i]) throw new ConversionError(`${arg} requires a path.`);
      output = argv[i];
    } else if (arg === '--force') {
      force = true;
    } else if (arg.startsWith('-')) {
      throw new ConversionError(`Unknown option: ${arg}`);
    } else if (input === null) {
      input = arg;
    } else {
      throw new ConversionError(`Unexpected extra argument: ${arg}`);
    }
  }

  if (input === null) throw new ConversionError('No input file given.');
  return { input, output, force, help: false };
}

function defaultOutputPath(inputPath) {
  const full = resolve(process.cwd(), inputPath);
  return full.endsWith('.json') ? `${full.slice(0, -'.json'.length)}.v3.json` : `${full}.v3.json`;
}

function toNumber(value) {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function toText(value) {
  return value == null ? '' : String(value);
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isV3Envelope(value) {
  return (
    isPlainObject(value) &&
    isAcceptedEnvelopeVersion(value.schema) &&
    Array.isArray(value.diagnosticReports)
  );
}

function isGroupShape(value) {
  return isPlainObject(value) && Array.isArray(value.items);
}

function isEntryShape(value) {
  return isPlainObject(value) && 'date' in value;
}

// Routes to the canonical-draws branch so malformed canonical data fails loudly
// instead of being misread as the legacy grouped shape.
function looksLikeCanonicalDraw(value) {
  if (!isPlainObject(value)) return false;
  if (typeof value.labName === 'string') return true;
  if (Array.isArray(value.items)) {
    return value.items.some((item) => isPlainObject(item) && ('original' in item || 'shortName' in item));
  }
  return false;
}

function toResult(raw) {
  return {
    loinc: toText(raw.loinc),
    analysis: toText(raw.analysis),
    value: toNumber(raw.value),
    rawValue: raw.rawValue != null ? String(raw.rawValue) : '',
    valueQualifier: toText(raw.valueQualifier),
    unit: toText(raw.unit),
    refText: toText(raw.refText),
    refMin: toNumber(raw.refMin),
    refMax: toNumber(raw.refMax),
    method: toText(raw.method),
  };
}

function drawItemToResult(item, drawIndex, itemIndex) {
  const where = `draw ${drawIndex}, item ${itemIndex}`;
  if (!isPlainObject(item)) throw new ConversionError(`${where}: not an object.`);

  const shortName = 'shortName' in item ? item.shortName : item.symbol;
  if (shortName == null && item.analysis == null && item.loinc == null) {
    throw new ConversionError(`${where}: needs at least one of shortName / analysis / loinc.`);
  }
  if (item.loinc != null && !V2_LOINC_RE.test(String(item.loinc))) {
    throw new ConversionError(`${where}: invalid LOINC code.`);
  }
  if (!isPlainObject(item.original)) {
    throw new ConversionError(`${where}: missing the "original" unit-value object.`);
  }
  const value = item.original.value;
  if (value !== null && typeof value !== 'number') {
    throw new ConversionError(`${where}: original.value must be a number or null.`);
  }

  return {
    loinc: toText(item.loinc),
    analysis: toText(item.analysis),
    value,
    rawValue: item.original.rawValue != null ? String(item.original.rawValue) : '',
    valueQualifier: '',
    unit: toText(item.original.unit),
    refText: toText(item.original.refText),
    refMin: item.original.refMin ?? null,
    refMax: item.original.refMax ?? null,
    method: toText(item.method),
  };
}

function drawsToSessions(draws) {
  return draws.map((draw, i) => {
    if (!isPlainObject(draw)) throw new ConversionError(`Draw ${i}: not an object.`);
    if (!DATE_RE.test(toText(draw.date))) {
      throw new ConversionError(`Draw ${i}: date must be YYYY-MM-DD.`);
    }
    if (typeof draw.labName !== 'string') throw new ConversionError(`Draw ${i}: labName must be a string.`);
    if (!Array.isArray(draw.items)) throw new ConversionError(`Draw ${i}: items must be an array.`);
    return {
      date: draw.date,
      place: draw.labName,
      items: draw.items.map((item, j) => drawItemToResult(item, i, j)),
    };
  });
}

function groupsToSessions(groups) {
  return groups.map((group) => ({
    date: toText(group.date),
    place: toText(group.place),
    items: (group.items || []).map(toResult),
  }));
}

function entriesToSessions(entries) {
  const byKey = new Map();
  for (const raw of entries) {
    const date = toText(raw.date);
    if (!date) continue;
    const place = toText(raw.place) || 'Unknown Lab';
    const key = `${date}__${place}`;
    if (!byKey.has(key)) byKey.set(key, { date, place, items: [] });
    byKey.get(key).items.push(toResult(raw));
  }
  if (byKey.size === 0) {
    throw new ConversionError('No dated result entries were found in that file.');
  }
  return Array.from(byKey.values());
}

// Observations used to carry the printed test name under "name"; the field is
// now "rawName". Renaming in place keeps every other key, and its order, as the
// source file had them.
function renameToRawName(reports) {
  let renamed = false;
  const converted = reports.map((report) => {
    if (!isPlainObject(report) || !Array.isArray(report.observations)) return report;
    return {
      ...report,
      observations: report.observations.map((obs) => {
        if (!isPlainObject(obs) || !('name' in obs) || 'rawName' in obs) return obs;
        renamed = true;
        return Object.fromEntries(
          Object.entries(obs).map(([key, value]) => [key === 'name' ? 'rawName' : key, value])
        );
      }),
    };
  });
  return { reports: converted, renamed };
}

function detectAndConvert(data) {
  if (isV3Envelope(data)) {
    const { reports, renamed } = renameToRawName(data.diagnosticReports);
    if (data.schema === SCHEMA_VERSION && !renamed) {
      return { shape: `v3 envelope (schema ${SCHEMA_VERSION})`, envelope: data, passThrough: true };
    }
    let shape;
    if (data.schema === SCHEMA_VERSION) {
      shape = `v3 envelope (schema ${SCHEMA_VERSION}, observation "name" renamed to "rawName")`;
    } else if (isCurrentMajor(data.schema)) {
      // An earlier minor of the same major — restamped to the current one,
      // which is a no-op on the reports themselves.
      shape = `v3 envelope (schema ${JSON.stringify(data.schema)} → ${SCHEMA_VERSION})`;
    } else {
      shape = 'v3 envelope (schema 1)';
    }
    return { shape, reports, source: data };
  }

  const arr = Array.isArray(data) ? data : [data];
  if (arr.length === 0) throw new ConversionError('The file is empty.');

  if (arr.some(looksLikeCanonicalDraw)) {
    return {
      shape: 'canonical draws (project-bloodtests-v2)',
      sessions: drawsToSessions(arr),
    };
  }

  if (arr.every(isGroupShape)) {
    return { shape: 'grouped sessions (legacy)', sessions: groupsToSessions(arr) };
  }

  if (arr.every(isEntryShape)) {
    return { shape: 'flat entries (legacy)', sessions: entriesToSessions(arr) };
  }

  throw new ConversionError(
    'Unrecognized JSON shape. Expected a v3 envelope, canonical draws, a list of ' +
      'result entries with a "date" field, or a list of sessions shaped like { date, place, items }.'
  );
}

function resultToObservation(result) {
  const obs = { loinc: result.loinc, rawName: result.analysis || 'Unknown Test' };

  if (result.value !== null) obs.value = result.value;
  if (COMPARATORS.has(result.valueQualifier)) obs.comparator = result.valueQualifier;
  if (result.rawValue) obs.rawValue = result.rawValue;
  if (result.unit) obs.unit = result.unit;

  const range = {};
  if (result.refMin !== null) range.low = result.refMin;
  if (result.refMax !== null) range.high = result.refMax;
  if (result.refText) range.text = result.refText;
  if (Object.keys(range).length > 0) obs.referenceRanges = [range];

  if (result.method) obs.method = result.method;

  return obs;
}

function sessionsToReports(sessions) {
  const dated = sessions.filter((session) => session.items.length > 0);
  for (const session of dated) {
    if (!DATE_RE.test(session.date)) {
      throw new ConversionError(
        `A session from "${session.place || 'unknown lab'}" has no usable YYYY-MM-DD date: ${JSON.stringify(session.date)}`
      );
    }
  }
  return dated
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((session) => ({
      lab: session.place || 'Unknown Lab',
      collectedAt: `${session.date}T00:00:00Z`,
      observations: session.items.map(resultToObservation),
    }));
}

// ADR-0001: sha256 over JSON.stringify(diagnosticReports) only, never the whole file.
function contentHashOf(reports) {
  return `sha256:${createHash('sha256').update(JSON.stringify(reports), 'utf8').digest('hex')}`;
}

function buildEnvelope(reports, source) {
  const envelope = {
    schema: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    contentHash: contentHashOf(reports),
    diagnosticReports: reports,
  };

  if (source) {
    for (const key of META_KEYS) {
      if (source[key] !== undefined) envelope[key] = source[key];
    }
    for (const [key, value] of Object.entries(source)) {
      if (!RESTAMPED_KEYS.has(key) && !META_KEYS.includes(key)) envelope[key] = value;
    }
  }

  return envelope;
}

function validateEnvelope(envelope) {
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  if (validate(envelope)) return;

  const errors = validate.errors ?? [];
  const lines = errors
    .slice(0, 20)
    .map((e) => `  ${e.instancePath || '/'} ${e.message}${e.params ? ` ${JSON.stringify(e.params)}` : ''}`);
  const more = errors.length > lines.length ? `\n  ... and ${errors.length - lines.length} more` : '';
  throw new ConversionError(
    `The converted envelope does not validate against ${basename(schemaPath)}:\n${lines.join('\n')}${more}`
  );
}

function countObservations(reports) {
  return reports.reduce((n, report) => n + (report.observations?.length ?? 0), 0);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(USAGE);
    return;
  }

  const inputPath = resolve(process.cwd(), args.input);
  if (!existsSync(inputPath)) throw new ConversionError(`Input file not found: ${inputPath}`);

  const outputPath = args.output ? resolve(process.cwd(), args.output) : defaultOutputPath(args.input);
  if (existsSync(outputPath) && !args.force) {
    throw new ConversionError(`Output file already exists: ${outputPath}\nPass --force to overwrite.`);
  }

  const rawText = readFileSync(inputPath, 'utf8');
  let data;
  try {
    data = JSON.parse(rawText);
  } catch (e) {
    throw new ConversionError(`Input is not valid JSON: ${e.message}`);
  }

  const detected = detectAndConvert(data);
  const envelope = detected.passThrough
    ? detected.envelope
    : buildEnvelope(detected.reports ?? sessionsToReports(detected.sessions), detected.source);

  if (envelope.diagnosticReports.length === 0) {
    throw new ConversionError('No reports with observations were found, so the envelope would be empty.');
  }

  validateEnvelope(envelope);

  writeFileSync(outputPath, detected.passThrough ? rawText : `${JSON.stringify(envelope, null, 2)}\n`, 'utf8');

  console.log(`Input shape:  ${detected.shape}`);
  if (detected.passThrough) console.log('Conversion:   none needed — copied through unchanged');
  console.log(`Reports:      ${envelope.diagnosticReports.length}`);
  console.log(`Observations: ${countObservations(envelope.diagnosticReports)}`);
  console.log(`Output:       ${outputPath}`);
}

try {
  main();
} catch (e) {
  console.error(e instanceof ConversionError ? `Error: ${e.message}` : e);
  process.exitCode = 1;
}
