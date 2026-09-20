import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadHeldFiles, payloadDigest } from '../src/data/storage/heldFiles';
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

  it('returns the folder file for file, texts untouched, and invents no manifest', async () => {
    const files = {
      'reports/2022-04-29__ygia.json': reportEnvelope('2022-04-29') + '\n',
      'reports/2024-05-01__ygia.json': reportEnvelope('2024-05-01'),
      'medications.json': '{"rows":[]}',
      'scheduled-visits.json': '{"visits":[]}',
    };
    reply(200, { files });
    expect(await pullCloudFiles()).toEqual(files);
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

  it('throws with the server error when signed out', async () => {
    reply(401, { error: 'Unauthorized' });
    await expect(pullCloudFiles()).rejects.toThrow(/401.*Unauthorized/);
  });

  it('throws with the status text when the error body is not JSON', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 502, statusText: 'Bad Gateway', json: () => Promise.reject(new Error('not json')) });
    await expect(pullCloudFiles()).rejects.toThrow(/502.*Bad Gateway/);
  });
});

const stored = (extra: Record<string, string> = {}): Record<string, string> => ({
  'reports/2024-05-01__ygia.json': reportEnvelope('2024-05-01'),
  'reports/2024-05-02__medilab.json': reportEnvelope('2024-05-02', 'MediLab') + '\n',
  'medications.json': '{"years":[2026],"rows":[]}',
  'scheduled-visits.json': '{"visits":[]}',
  'settings.json': '{}',
  'manifest.json': '{"format":"blood-tests-backup","version":1,"files":[]}',
  ...extra,
});

const sentFiles = (call = 0): Record<string, string> => JSON.parse(fetchMock.mock.calls[call][1].body).files;

describe('pushCloudFiles', () => {
  it('sends the given files, texts byte for byte, in one PUT', async () => {
    reply(200, { commit: 'abc' });
    const files = stored();
    expect(await pushCloudFiles(files)).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/data');
    expect(init.method).toBe('PUT');
    expect(init.credentials).toBe('same-origin');
    expect(init.headers).toEqual({ 'X-Paneloom': '1', 'Content-Type': 'application/json' });
    expect(sentFiles()).toEqual(files);
  });

  it('a pull followed by a push of what was pulled sends the pulled texts', async () => {
    const cloud = stored();
    reply(200, { files: cloud });
    reply(200, { commit: null });
    const pulled = (await pullCloudFiles()) as Record<string, string>;
    await pushCloudFiles(pulled);
    expect(sentFiles(1)).toEqual(cloud);
  });

  it('remembers the pushed manifest with the digest of the payload it described', async () => {
    reply(200, { commit: 'a' });
    const { 'manifest.json': manifest, ...payload } = stored();
    await pushCloudFiles(stored());
    const held = loadHeldFiles();
    expect(held.manifest).toBe(manifest);
    expect(held.digest).toBe(payloadDigest(payload));
  });

  it('keeps what else is held when it remembers the manifest', async () => {
    store.set('paneloom_held_files_v1', JSON.stringify({ reports: { 'reports/a.json': 'A' }, other: { 'settings.json': '{}' }, state: { 'settings.json': '{}' } }));
    reply(200, { commit: 'a' });
    await pushCloudFiles(stored());
    expect(loadHeldFiles()).toMatchObject({ reports: { 'reports/a.json': 'A' }, other: { 'settings.json': '{}' }, state: { 'settings.json': '{}' } });
  });

  it('remembers nothing when the files carry no manifest', async () => {
    reply(200, { commit: 'a' });
    const noManifest = Object.fromEntries(Object.entries(stored()).filter(([name]) => name !== 'manifest.json'));
    await pushCloudFiles(noManifest);
    expect(loadHeldFiles().manifest).toBeUndefined();
  });

  it('skips the push when there are no reports, medications or visits', async () => {
    const pushed = await pushCloudFiles({
      'manifest.json': '{}',
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
    expect(Object.keys(sentFiles())).toEqual(['medications.json']);
  });

  it('throws on a 409', async () => {
    reply(409, { error: 'conflict' });
    await expect(pushCloudFiles({ 'medications.json': '{"rows":[{"id":"x"}]}' })).rejects.toThrow(/409.*conflict/);
  });
});

describe('pushBeforeSignOut', () => {
  const local = stored();
  const puts = () => fetchMock.mock.calls.filter(([, init]) => init.method === 'PUT');

  function replyFail(status: number) {
    fetchMock.mockResolvedValueOnce({ ok: false, status, statusText: 'x', json: () => Promise.resolve({ error: 'no' }) });
  }

  it("returns 'saved' after pushing local data, without pulling first", async () => {
    reply(200, { ok: true });
    await expect(pushBeforeSignOut(local)).resolves.toBe('saved');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(puts()).toHaveLength(1);
    expect(sentFiles()).toEqual(local);
  });

  it.each([401, 403])("returns 'auth' when the push fails with %i", async (status) => {
    replyFail(status);
    await expect(pushBeforeSignOut(local)).resolves.toBe('auth');
  });

  it("returns 'failed' when the push fails with a 500", async () => {
    replyFail(500);
    await expect(pushBeforeSignOut(local)).resolves.toBe('failed');
  });

  it("returns 'failed' when the push hits a network error", async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    await expect(pushBeforeSignOut(local)).resolves.toBe('failed');
  });

  it("returns 'saved' without any request when local is empty, even over a populated cloud", async () => {
    await expect(pushBeforeSignOut({ 'manifest.json': stored()['manifest.json']! })).resolves.toBe('saved');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 'failed' when the push fails with a 409", async () => {
    replyFail(409);
    await expect(pushBeforeSignOut(local)).resolves.toBe('failed');
  });
});
