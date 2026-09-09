import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const catalogPath = resolve(here, '../public/data/analyses.json');
const fixturePath = resolve(here, '../test/fixtures/loinc-long-common-names.json');

const ENDPOINT = 'https://clinicaltables.nlm.nih.gov/api/loinc_items/v3/search';

async function lookup(loinc) {
  const url = `${ENDPOINT}?terms=${encodeURIComponent(loinc)}&df=LOINC_NUM,LONG_COMMON_NAME&maxList=5`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${loinc}: HTTP ${res.status}`);
  const [, , , rows] = await res.json();
  const hit = (rows ?? []).find((r) => r[0] === loinc);
  return hit ? hit[1] : null;
}

const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
const names = {};
const unknownToService = [];

for (const entry of catalog) {
  const name = await lookup(entry.loinc);
  if (name === null) unknownToService.push(entry.loinc);
  else names[entry.loinc] = name;
  process.stdout.write('.');
}
process.stdout.write('\n');

writeFileSync(
  fixturePath,
  `${JSON.stringify(
    {
      source: ENDPOINT,
      retrieved: new Date().toISOString().slice(0, 10),
      names: Object.fromEntries(Object.keys(names).sort().map((k) => [k, names[k]])),
      unknownToService: unknownToService.sort(),
    },
    null,
    2,
  )}\n`,
);

console.log(`wrote ${Object.keys(names).length} names to ${fixturePath}`);
if (unknownToService.length) console.log(`the service knows no name for: ${unknownToService.join(', ')}`);
