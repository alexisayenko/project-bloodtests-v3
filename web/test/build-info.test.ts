import { describe, it, expect } from 'vitest';
import { DEV_COMMIT, buildYear, commitUrl, copyrightLine, formatBuildTime } from '../src/components/buildInfo';

describe('footer build stamp', () => {
  it('renders the copyright line for the build year', () => {
    expect(copyrightLine('2026-09-09T14:32:07.000Z')).toBe('© 2026 Alex Isayenko');
    expect(buildYear('2024-01-01T00:00:00.000Z')).toBe(2024);
  });

  it('formats the build time as a readable UTC stamp', () => {
    expect(formatBuildTime('2026-09-09T14:32:07.000Z')).toBe('2026-09-09 14:32 UTC');
  });

  it('passes an unparseable stamp through instead of showing Invalid Date', () => {
    expect(formatBuildTime('not-a-date')).toBe('not-a-date');
  });

  it('links a hash-shaped commit to its GitHub page', () => {
    const commit = '328bb5c';
    expect(commit).toMatch(/^[0-9a-f]{7,8}$/);
    expect(commitUrl(commit)).toBe(
      'https://github.com/alexisayenko/project-bloodtests-v3/commit/328bb5c',
    );
    expect(DEV_COMMIT).toBe('dev');
  });
});
