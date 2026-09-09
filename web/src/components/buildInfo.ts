const COMMIT_URL_BASE = 'https://github.com/alexisayenko/project-bloodtests-v3/commit/';

// What vite.config.ts injects when neither CI nor git can supply a commit.
export const DEV_COMMIT = 'dev';

export function commitUrl(commit: string): string {
  return COMMIT_URL_BASE + commit;
}

export function formatBuildTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
}

export function buildYear(iso: string): number {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? new Date().getUTCFullYear() : d.getUTCFullYear();
}

export function copyrightLine(iso: string): string {
  return `© ${buildYear(iso)} Alex Isayenko`;
}
