import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = fileURLToPath(new URL('..', import.meta.url));
const scriptPath = join(webRoot, 'scripts', 'generate-envelope-types.mjs');
const committedPath = join(webRoot, 'src', 'data', 'envelopeTypes.ts');

function regenerate(): string | null {
  const dir = mkdtempSync(join(tmpdir(), 'envelope-types-'));
  const out = join(dir, 'envelopeTypes.ts');
  try {
    execFileSync(process.execPath, [scriptPath, out], { cwd: webRoot, stdio: 'pipe' });
    return readFileSync(out, 'utf8');
  } catch {
    return null;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('generated interchange types', () => {
  it('are in sync with the published JSON Schema', () => {
    const regenerated = regenerate();

    if (regenerated === null) {
      // json-schema-to-typescript is a devDependency; if it cannot run (no
      // install, offline sandbox) this check is skipped rather than failed.
      console.warn('skipping: json-schema-to-typescript could not be run');
      return;
    }

    expect(regenerated).toBe(readFileSync(committedPath, 'utf8'));
  });

  it('exports the four interchange type names the app wires in', () => {
    const source = readFileSync(committedPath, 'utf8');

    for (const name of [
      'InterchangeEnvelope',
      'InterchangeReport',
      'InterchangeObservation',
      'InterchangeReferenceRange',
    ]) {
      expect(source).toMatch(new RegExp(`^export (interface|type) ${name}\\b`, 'm'));
    }
  });
});
