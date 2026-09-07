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

const SCHEMA_VERSION = 3;

const USAGE = `Usage: node scripts/recode-molar.mjs <input.json> [-o output.json] [--force]

Repairs a schema-${SCHEMA_VERSION} envelope in which a lab reported a molar
(substance/volume) unit under a mass-concentration LOINC. Only the "loinc"
field is rewritten, to the analyte's [Moles/volume] sibling — value, rawValue,
unit and reference ranges are left exactly as printed, because a molar unit
under a mass code is a CODE error, never a number to convert (ADR-0003).

Options:
  -o, --output <path>  Output file (default: <input>.recoded.json beside the input)
      --force          Overwrite an existing output file
  -h, --help           Show this message`;

// Mirrors the [Mass/volume] → [Moles/volume] pairs in
// src/data/massMolarSiblings.ts; kept inline because this is a plain-Node
// one-off and the app's table is TypeScript.
const MASS_TO_MOLAR = {
  '2339-0': '15074-8',
  '2093-3': '14647-2',
  '2085-9': '14646-4',
  '13457-7': '22748-8',
  '2571-8': '14927-8',
  '1975-2': '14631-6',
  '1968-7': '14629-0',
  '1971-1': '14630-8',
  '3024-7': '14920-3',
  '17861-6': '2000-8',
  '3094-0': '14937-7',
  '2160-0': '14682-9',
  '3084-1': '14933-6',
  '19123-9': '2601-3',
  '2777-1': '14879-1',
  '2345-7': '14749-6',
  '3091-6': '22664-7',
  '2498-4': '14798-3',
  '2986-8': '14913-8',
  '2143-6': '14675-3',
};

const MOLE_TOKENS = new Set([
  'mol',
  'mmol',
  'umol',
  'nmol',
  'pmol',
  'fmol',
  'моль',
  'ммоль',
  'мкмоль',
  'нмоль',
  'пмоль',
  'фмоль',
]);

const VOLUME_TOKENS = new Set(['l', 'dl', 'ml', 'ul', 'nl', 'fl', 'л', 'дл', 'мл', 'мкл', 'нл', 'фл']);

class RecodeError extends Error {}

function parseArgs(argv) {
  let input = null;
  let output = null;
  let force = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') return { help: true };
    if (arg === '-o' || arg === '--output') {
      i += 1;
      if (!argv[i]) throw new RecodeError(`${arg} requires a path.`);
      output = argv[i];
    } else if (arg === '--force') {
      force = true;
    } else if (arg.startsWith('-')) {
      throw new RecodeError(`Unknown option: ${arg}`);
    } else if (input === null) {
      input = arg;
    } else {
      throw new RecodeError(`Unexpected extra argument: ${arg}`);
    }
  }

  if (input === null) throw new RecodeError('No input file given.');
  return { input, output, force, help: false };
}

function defaultOutputPath(inputPath) {
  const full = resolve(process.cwd(), inputPath);
  return full.endsWith('.json') ? `${full.slice(0, -'.json'.length)}.recoded.json` : `${full}.recoded.json`;
}

function clean(unit) {
  return String(unit ?? '')
    .trim()
    .toLowerCase()
    .replace(/[µμ]/g, 'u')
    .replace(/\s+/g, '');
}

/** True for a substance-per-volume unit in either Latin or Cyrillic spelling. */
function isMolarConcentration(unit) {
  const parts = clean(unit).split('/');
  return parts.length === 2 && MOLE_TOKENS.has(parts[0]) && VOLUME_TOKENS.has(parts[1]);
}

function contentHashOf(reports) {
  return `sha256:${createHash('sha256').update(JSON.stringify(reports), 'utf8').digest('hex')}`;
}

function recode(envelope) {
  const rows = [];
  const reports = envelope.diagnosticReports.map((report) => ({
    ...report,
    observations: (report.observations ?? []).map((observation) => {
      const sibling = MASS_TO_MOLAR[observation.loinc];
      if (!sibling || !isMolarConcentration(observation.unit)) return observation;
      rows.push({
        from: observation.loinc,
        to: sibling,
        unit: observation.unit ?? '',
        rawName: observation.rawName ?? '',
      });
      return { ...observation, loinc: sibling };
    }),
  }));
  return { reports, rows };
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
  throw new RecodeError(
    `The recoded envelope does not validate against ${basename(schemaPath)}:\n${lines.join('\n')}${more}`
  );
}

function printAudit(rows) {
  for (const row of rows) {
    console.log(`  ${row.from} -> ${row.to}  ${row.unit.padEnd(10)}  ${row.rawName}`);
  }
  const perCode = new Map();
  for (const row of rows) {
    const key = `${row.from} -> ${row.to}`;
    perCode.set(key, (perCode.get(key) ?? 0) + 1);
  }
  console.log('\nSummary:');
  for (const [key, count] of [...perCode].sort()) console.log(`  ${key}  ${count}`);
  console.log(`  codes recoded: ${perCode.size}, observations recoded: ${rows.length}`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(USAGE);
    return;
  }

  const inputPath = resolve(process.cwd(), args.input);
  if (!existsSync(inputPath)) throw new RecodeError(`Input file not found: ${inputPath}`);

  const outputPath = args.output ? resolve(process.cwd(), args.output) : defaultOutputPath(args.input);
  if (existsSync(outputPath) && !args.force) {
    throw new RecodeError(`Output file already exists: ${outputPath}\nPass --force to overwrite.`);
  }

  let data;
  try {
    data = JSON.parse(readFileSync(inputPath, 'utf8'));
  } catch (e) {
    throw new RecodeError(`Input is not valid JSON: ${e.message}`);
  }
  if (data?.schema !== SCHEMA_VERSION || !Array.isArray(data.diagnosticReports)) {
    throw new RecodeError(
      `Input is not a schema-${SCHEMA_VERSION} envelope. Run scripts/convert-to-v3.mjs on it first.`
    );
  }

  const { reports, rows } = recode(data);
  const envelope = { ...data, diagnosticReports: reports, contentHash: contentHashOf(reports) };

  validateEnvelope(envelope);
  writeFileSync(outputPath, `${JSON.stringify(envelope, null, 2)}\n`, 'utf8');

  printAudit(rows);
  console.log(`\nOutput:       ${outputPath}`);
}

try {
  main();
} catch (e) {
  console.error(e instanceof RecodeError ? `Error: ${e.message}` : e);
  process.exitCode = 1;
}
