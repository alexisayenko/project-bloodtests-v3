import { describe, it, expect } from 'vitest';
import { getPanelMeta } from '../src/components/conditions/panelMeta';
import { TINT } from '../src/styles/tokens';

const KNOWN = [
  'Hypogonadism',
  'Hypothyroidism',
  'Thyroid',
  'Adrenal',
  'Insulin Resistance',
  'Cardiovascular Risk',
  'Fatty Liver',
  'Liver Health',
  'Kidney Function',
  'Anemia',
  'Hematology',
  'Bone and Mineral Metabolism',
  'Pancreatic Function',
  'FBC',
];

describe('getPanelMeta', () => {
  it('gives every known panel an icon, a description and four colour roles as design tokens', () => {
    for (const name of KNOWN) {
      const meta = getPanelMeta(name);
      expect(meta.icon, name).toBeTruthy();
      expect(meta.description, name).not.toBe('');
      for (const role of [meta.color, meta.bgColor, meta.iconBg, meta.borderColor]) {
        expect(role, name).toMatch(/^var\(--/);
      }
    }
  });

  it('falls back to the teal identity with no description for a panel it does not know', () => {
    const meta = getPanelMeta('Something New');
    expect(meta.description).toBe('');
    expect(meta.color).toBe(TINT.teal.ink);
    expect(meta.bgColor).toBe(TINT.teal.bg);
    expect(meta.icon).toBeTruthy();
  });

  it('maps a tint onto the four roles in order: ink, background, icon disc, border', () => {
    const meta = getPanelMeta('Hypogonadism');
    expect(meta).toMatchObject({
      color: TINT.blue.ink,
      bgColor: TINT.blue.bg,
      iconBg: TINT.blue.icon,
      borderColor: TINT.blue.line,
    });
  });

  it('lets a renamed panel keep the identity of its old name', () => {
    expect(getPanelMeta('Thyroid')).toEqual(getPanelMeta('Hypothyroidism'));
    expect(getPanelMeta('Liver Health')).toEqual(getPanelMeta('Fatty Liver'));
    expect(getPanelMeta('Hematology')).toEqual(getPanelMeta('Anemia'));
  });

  it('darkens only the ink where a shared tint needs a distinct text colour', () => {
    const kidney = getPanelMeta('Kidney Function');
    expect(kidney.color).toBe(TINT.ochreInk);
    expect(kidney.bgColor).toBe(TINT.amber.bg);
    const anemia = getPanelMeta('Anemia');
    expect(anemia.color).toBe(TINT.crimsonInk);
    expect(anemia.bgColor).toBe(TINT.rose.bg);
  });

  it('is case-sensitive, so a differently-cased name gets the fallback', () => {
    expect(getPanelMeta('hypogonadism').description).toBe('');
  });
});
