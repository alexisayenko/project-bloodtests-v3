import { describe, expect, it } from 'vitest';
import worker from '../worker/index';
import { SITE_GUIDE, handleSiteGuideRequest, isSiteGuidePath } from '../worker/siteGuide';
import { CHATBOT_PROMPT } from '../src/data/chatbotPrompt';
import { SCHEMA_VERSION } from '../src/data/envelopeSchema';
import { NEWCOMER_PROMPT, SITE_GUIDE_PATH, SITE_GUIDE_URL } from '../src/data/sitePrompt';
import { NAV_ITEMS, navItemRoute, routeToHash } from '../src/components/conditions/routing';
import monitoringPanels from '../public/data/monitoring-panels.json';

const ORIGIN = 'https://paneloom.com';

describe('newcomer prompt', () => {
  it('sends the chatbot to the guide URL, which is the /prompt route', () => {
    expect(SITE_GUIDE_URL).toBe(`${ORIGIN}/prompt`);
    expect(SITE_GUIDE_PATH).toBe('/prompt');
    expect(NEWCOMER_PROMPT).toContain(SITE_GUIDE_URL);
    expect(NEWCOMER_PROMPT.length).toBeLessThan(300);
  });
});

describe('SITE_GUIDE', () => {
  it('names every menu section with its URL hash', () => {
    for (const item of NAV_ITEMS) {
      expect(SITE_GUIDE).toContain(item.label);
      expect(SITE_GUIDE).toContain(routeToHash(navItemRoute(item.view)));
    }
  });

  it('names every monitoring panel', () => {
    for (const { name } of monitoringPanels) expect(SITE_GUIDE).toContain(name);
  });

  it('carries the extraction prompt verbatim, the schema version and the schema URL', () => {
    expect(SITE_GUIDE).toContain(CHATBOT_PROMPT);
    expect(SITE_GUIDE).toContain(`"schema": "${SCHEMA_VERSION}"`);
    expect(SITE_GUIDE).toContain(`${ORIGIN}/schema/bloodtests-3.schema.json`);
  });

  it('covers the sections a chatbot needs to guide a user', () => {
    for (const heading of [
      '## 1. What Paneloom is',
      '## 2. How to help the user',
      '## 3. Key concepts',
      '## 4. Quick-start paths',
      '## 5. Every feature, step by step',
      '## 6. Where data lives and privacy',
      '## 7. The import file format',
      '## 8. Addresses a bot or user can use',
      '## 9. Limitations',
      '## 10. Troubleshooting',
      '## 12. Extraction instructions',
    ]) {
      expect(SITE_GUIDE).toContain(heading);
    }
  });

  it('quotes the real button labels the user will click', () => {
    for (const label of [
      'Generate Test Data',
      'Import JSON',
      'Cross-check LOINCs',
      'Check online (NLM)',
      'Export all data',
      'Import all data',
      'Clear all data',
      'Clear local DB',
      'Add medication',
      'Show generic names',
    ]) {
      expect(SITE_GUIDE).toContain(`"${label}"`);
    }
  });
});

describe('the /prompt route', () => {
  it('matches /prompt, /prompt/ and /prompt.md only', () => {
    expect(isSiteGuidePath('/prompt')).toBe(true);
    expect(isSiteGuidePath('/prompt/')).toBe(true);
    expect(isSiteGuidePath('/prompt.md')).toBe(true);
    expect(isSiteGuidePath('/prompts')).toBe(false);
    expect(isSiteGuidePath('/')).toBe(false);
  });

  it('serves the guide as UTF-8 plain text a bot can read', async () => {
    const res = handleSiteGuideRequest(new Request(`${ORIGIN}/prompt`));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(await res.text()).toBe(SITE_GUIDE);
  });

  it('answers HEAD with headers only and rejects other methods', async () => {
    const head = handleSiteGuideRequest(new Request(`${ORIGIN}/prompt`, { method: 'HEAD' }));
    expect(head.status).toBe(200);
    expect(await head.text()).toBe('');
    const post = handleSiteGuideRequest(new Request(`${ORIGIN}/prompt`, { method: 'POST' }));
    expect(post.status).toBe(405);
    expect(post.headers.get('Allow')).toBe('GET, HEAD');
  });

  it('is routed by the Worker ahead of the static assets', async () => {
    const assets: string[] = [];
    const env = { ASSETS: { fetch: (req: Request) => { assets.push(new URL(req.url).pathname); return new Response('asset'); } } };
    const guide = await worker.fetch(new Request(`${ORIGIN}/prompt`), env as never, {} as never);
    expect(await guide.text()).toBe(SITE_GUIDE);
    await worker.fetch(new Request(`${ORIGIN}/index.html`), env as never, {} as never);
    expect(assets).toEqual(['/index.html']);
  });
});
