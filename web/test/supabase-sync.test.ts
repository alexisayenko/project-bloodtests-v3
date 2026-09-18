import { describe, it, expect, vi, beforeEach } from 'vitest';
import { splitReportsToFiles } from '../src/data/reportFiles';
import { pullCloudFiles, pushCloudFiles } from '../src/supabase/sync';

const getSession = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: { getSession: (...args: unknown[]) => getSession(...args) } }),
}));

const fetchMock = vi.fn();

function reply(status: number, body: unknown) {
  fetchMock.mockResolvedValueOnce({ ok: status >= 200 && status < 300, status, statusText: 'x', json: () => Promise.resolve(body) });
}

const reportEnvelope = (day: string, lab = 'Ygia') =>
  JSON.stringify({ schema: '3.1', diagnosticReports: [{ lab, collectedAt: `${day}T00:00:00Z`, observations: [] }] });

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  fetchMock.mockReset();
  getSession.mockReset();
  getSession.mockResolvedValue({ data: { session: { access_token: 'tok-1' } } });
  vi.stubGlobal('fetch', fetchMock);
});

describe('pullCloudFiles', () => {
  it('sends the bearer token to GET /api/data', async () => {
    reply(200, { files: {} });
    await pullCloudFiles();
    expect(fetchMock).toHaveBeenCalledWith('/api/data', expect.objectContaining({ method: 'GET', headers: { Authorization: 'Bearer tok-1' } }));
  });

  it('returns null for an empty cloud folder', async () => {
    reply(200, { files: {} });
    expect(await pullCloudFiles()).toBeNull();
  });

  it('merges report files into lab-reports.json and derives the manifest when the cloud has none', async () => {
    reply(200, {
      files: {
        'reports/2022-04-29__ygia.json': reportEnvelope('2022-04-29'),
        'reports/2024-05-01__ygia.json': reportEnvelope('2024-05-01'),
        'medications.json': '{"rows":[]}',
        'scheduled-visits.json': '{"visits":[]}',
      },
    });
    const files = (await pullCloudFiles()) as Record<string, string>;
    expect(Object.keys(files).sort()).toEqual(['lab-reports.json', 'manifest.json', 'medications.json', 'scheduled-visits.json']);
    expect(JSON.parse(files['lab-reports.json']).diagnosticReports.map((r: { collectedAt: string }) => r.collectedAt.slice(0, 4))).toEqual(['2024', '2022']);
    expect(files['medications.json']).toBe('{"rows":[]}');
    expect(JSON.parse(files['manifest.json'])).toMatchObject({ format: 'blood-tests-backup', version: 1, files: ['lab-reports.json', 'medications.json', 'scheduled-visits.json'] });
  });

  it('returns settings.json and the stored manifest as they are', async () => {
    reply(200, {
      files: {
        'reports/2022-04-29__ygia.json': reportEnvelope('2022-04-29'),
        'settings.json': '{"a":1}',
        'manifest.json': '{"format":"blood-tests-backup","version":1,"exportedAt":"T0"}',
      },
    });
    const files = (await pullCloudFiles()) as Record<string, string>;
    expect(files['settings.json']).toBe('{"a":1}');
    expect(files['manifest.json']).toBe('{"format":"blood-tests-backup","version":1,"exportedAt":"T0"}');
  });

  it.each([
    ['only a manifest', { 'manifest.json': '{}' }],
    ['empty medications, visits and settings', { 'medications.json': '{"rows":[]}', 'scheduled-visits.json': '{"visits":[]}', 'settings.json': '{"a":1}' }],
    ['unparseable medications', { 'medications.json': 'nope' }],
  ])('returns null for a cloud folder with %s', async (_label, files) => {
    reply(200, { files });
    expect(await pullCloudFiles()).toBeNull();
  });

  it('returns a folder that holds only medications', async () => {
    reply(200, { files: { 'medications.json': '{"rows":[{"id":"x"}]}' } });
    expect(await pullCloudFiles()).not.toBeNull();
  });

  it('omits lab-reports.json when the folder has no report files', async () => {
    reply(200, { files: { 'medications.json': '{"rows":[{"id":"x"}]}' } });
    const files = (await pullCloudFiles()) as Record<string, string>;
    expect(files).not.toHaveProperty('lab-reports.json');
  });

  it('throws when signed out without calling the API', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    await expect(pullCloudFiles()).rejects.toThrow('Not signed in');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws with the server error on a non-2xx response', async () => {
    reply(401, { error: 'bad token' });
    await expect(pullCloudFiles()).rejects.toThrow(/401.*bad token/);
  });
});

const localFiles = (exportedAt: string, extra: Record<string, string> = {}) => ({
  'manifest.json': JSON.stringify({ format: 'blood-tests-backup', version: 1, exportedAt }),
  'lab-reports.json': JSON.stringify({
    schema: '3.1',
    diagnosticReports: [
      { lab: 'Ygia', collectedAt: '2024-05-01T00:00:00Z', observations: [] },
      { lab: 'MediLab', collectedAt: '2024-05-02T00:00:00Z', observations: [] },
    ],
  }),
  'medications.json': '{"rows":[]}',
  'scheduled-visits.json': '{"visits":[]}',
  'laboratory-prices.json': '[]',
  'settings.json': '{}',
  ...extra,
});

const sentFiles = (call = 0): Record<string, string> => JSON.parse(fetchMock.mock.calls[call][1].body).files;

describe('pushCloudFiles', () => {
  it('splits reports and sends the synced files, never laboratory-prices.json, in one PUT', async () => {
    reply(200, { commit: 'abc' });
    await pushCloudFiles(localFiles('T1'));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/data');
    expect(init.method).toBe('PUT');
    expect(init.headers).toEqual({ Authorization: 'Bearer tok-1', 'Content-Type': 'application/json' });
    expect(Object.keys(sentFiles()).sort()).toEqual([
      'manifest.json',
      'medications.json',
      'reports/2024-05-01__ygia.json',
      'reports/2024-05-02__medilab.json',
      'scheduled-visits.json',
      'settings.json',
    ]);
    expect(JSON.parse(sentFiles()['manifest.json']).exportedAt).toBe('T1');
  });

  it('resends the previous manifest verbatim while no other file changed', async () => {
    reply(200, { commit: 'a' });
    reply(200, { commit: null });
    await pushCloudFiles(localFiles('T1'));
    await pushCloudFiles(localFiles('T2'));
    expect(sentFiles(1)['manifest.json']).toBe(sentFiles(0)['manifest.json']);
  });

  it('takes the fresh manifest when any file differs from the baseline', async () => {
    reply(200, { commit: 'a' });
    reply(200, { commit: 'b' });
    await pushCloudFiles(localFiles('T1'));
    await pushCloudFiles(localFiles('T2', { 'settings.json': '{"a":1}' }));
    expect(JSON.parse(sentFiles(1)['manifest.json']).exportedAt).toBe('T2');
  });

  it('reuses the pulled manifest for an unchanged first push', async () => {
    const pulled = localFiles('T0');
    const cloudFiles = { ...(await splitReportsToFiles(pulled['lab-reports.json'])), 'medications.json': pulled['medications.json'], 'scheduled-visits.json': pulled['scheduled-visits.json'], 'settings.json': pulled['settings.json'], 'manifest.json': pulled['manifest.json'] };
    reply(200, { files: cloudFiles });
    reply(200, { commit: null });
    await pullCloudFiles();
    await pushCloudFiles(localFiles('T9'));
    expect(sentFiles(1)['manifest.json']).toBe(pulled['manifest.json']);
  });

  it('forgets the baseline when the cloud comes back empty', async () => {
    reply(200, { commit: 'a' });
    reply(200, { files: {} });
    reply(200, { commit: 'b' });
    await pushCloudFiles(localFiles('T1'));
    await pullCloudFiles();
    await pushCloudFiles(localFiles('T2'));
    expect(JSON.parse(sentFiles(2)['manifest.json']).exportedAt).toBe('T2');
  });

  it('skips the push when there are no reports, medications or visits', async () => {
    const pushed = await pushCloudFiles({
      'manifest.json': '{}',
      'lab-reports.json': JSON.stringify({ schema: '3.1', diagnosticReports: [] }),
      'medications.json': '{"rows":[]}',
      'scheduled-visits.json': '{"visits":[]}',
      'settings.json': '{"a":1}',
    });
    expect(pushed).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('pushes medications on their own', async () => {
    reply(200, { commit: 'a' });
    expect(await pushCloudFiles({ 'medications.json': '{"rows":[{"id":"x"}]}' })).toBe(true);
    expect(Object.keys(sentFiles()).sort()).toEqual(['manifest.json', 'medications.json']);
  });

  it('throws on a 409', async () => {
    reply(409, { error: 'conflict' });
    await expect(pushCloudFiles({ 'medications.json': '{"rows":[{"id":"x"}]}' })).rejects.toThrow(/409.*conflict/);
  });
});
