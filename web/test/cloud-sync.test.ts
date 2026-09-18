import { describe, it, expect, vi, beforeEach } from 'vitest';
import { splitReportsToFiles } from '../src/data/reportFiles';
import { pullCloudFiles, pushBeforeSignOut, pushCloudFiles } from '../src/cloud/sync';

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
  vi.stubGlobal('fetch', fetchMock);
});

describe('pullCloudFiles', () => {
  it('sends a cookie-credentialed GET /api/data with no bearer token', async () => {
    reply(200, { files: {} });
    await pullCloudFiles();
    expect(fetchMock).toHaveBeenCalledWith('/api/data', expect.objectContaining({ method: 'GET', credentials: 'same-origin', headers: {} }));
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

  it('throws with the server error when signed out', async () => {
    reply(401, { error: 'Unauthorized' });
    await expect(pullCloudFiles()).rejects.toThrow(/401.*Unauthorized/);
  });

  it('throws with the status text when the error body is not JSON', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 502, statusText: 'Bad Gateway', json: () => Promise.reject(new Error('not json')) });
    await expect(pullCloudFiles()).rejects.toThrow(/502.*Bad Gateway/);
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
    expect(init.credentials).toBe('same-origin');
    expect(init.headers).toEqual({ 'X-Paneloom': '1', 'Content-Type': 'application/json' });
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

describe('pushBeforeSignOut', () => {
  const manifest = JSON.stringify({ format: 'blood-tests-backup', version: 1, exportedAt: 'T0', files: [] });
  const local = { 'manifest.json': manifest, 'lab-reports.json': reportEnvelope('2024-05-01') };
  const puts = () => fetchMock.mock.calls.filter(([, init]) => init.method === 'PUT');

  function replyFail(status: number) {
    fetchMock.mockResolvedValueOnce({ ok: false, status, statusText: 'x', json: () => Promise.resolve({ error: 'no' }) });
  }

  it.each([401, 403])("returns 'auth' without pushing when the pull fails with %i", async (status) => {
    replyFail(status);
    await expect(pushBeforeSignOut(local)).resolves.toBe('auth');
    expect(puts()).toHaveLength(0);
  });

  it("returns 'failed' without pushing when the pull fails with a 500", async () => {
    replyFail(500);
    await expect(pushBeforeSignOut(local)).resolves.toBe('failed');
    expect(puts()).toHaveLength(0);
  });

  it("returns 'failed' without pushing when the pull hits a network error", async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    await expect(pushBeforeSignOut(local)).resolves.toBe('failed');
    expect(puts()).toHaveLength(0);
  });

  it("returns 'saved' after pushing local data", async () => {
    reply(200, { files: {} });
    reply(200, { ok: true });
    await expect(pushBeforeSignOut(local)).resolves.toBe('saved');
    expect(puts()).toHaveLength(1);
  });

  it("returns 'saved' without any request when local is empty, even over a populated cloud", async () => {
    await expect(pushBeforeSignOut({ 'manifest.json': manifest })).resolves.toBe('saved');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 'failed' when the push fails with a 409", async () => {
    reply(200, { files: {} });
    replyFail(409);
    await expect(pushBeforeSignOut(local)).resolves.toBe('failed');
  });

  it("returns 'auth' when the push fails with a 401", async () => {
    reply(200, { files: {} });
    replyFail(401);
    await expect(pushBeforeSignOut(local)).resolves.toBe('auth');
  });
});
