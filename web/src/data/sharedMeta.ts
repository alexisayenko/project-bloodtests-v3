export type SharedMetaSettings = {
  unitSystem?: 'si' | 'us';
  sampleLimit?: number | 'all';
  dateOrder?: 'asc' | 'desc';
};

export type SharedMeta = {
  title?: string;
  showPanels?: string[];
  settings?: SharedMetaSettings;
};

export const SHARED_META_KEY = 'bloodtests_shared_meta_v1';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function parseSettings(raw: unknown): SharedMetaSettings | undefined {
  if (!isRecord(raw)) return undefined;
  const out: SharedMetaSettings = {};
  if (raw.unitSystem === 'si' || raw.unitSystem === 'us') out.unitSystem = raw.unitSystem;
  if (raw.sampleLimit === 'all') out.sampleLimit = 'all';
  else if (typeof raw.sampleLimit === 'number' && Number.isFinite(raw.sampleLimit) && raw.sampleLimit > 0) {
    out.sampleLimit = raw.sampleLimit;
  }
  if (raw.dateOrder === 'asc' || raw.dateOrder === 'desc') out.dateOrder = raw.dateOrder;
  return Object.keys(out).length > 0 ? out : undefined;
}

// Every field is optional and every malformed field is dropped rather than
// rejected: a share link must keep working whatever its meta file says.
export function parseSharedMeta(raw: unknown): SharedMeta | null {
  if (!isRecord(raw)) return null;
  const meta: SharedMeta = {};
  if (typeof raw.title === 'string' && raw.title.trim()) meta.title = raw.title;
  if (Array.isArray(raw.showPanels)) {
    meta.showPanels = raw.showPanels.filter((n): n is string => typeof n === 'string');
  }
  const settings = parseSettings(raw.settings);
  if (settings) meta.settings = settings;
  return meta;
}

export function panelAllowlist(meta: SharedMeta | null): string[] | null {
  return meta?.showPanels ?? null;
}

export function isPanelVisible(name: string, allow: string[] | null): boolean {
  return allow === null || allow.includes(name);
}

/** Allowlist filter for the panels grid; unknown names in the list simply match nothing. */
export function visiblePanels<T extends { name: string }>(panels: T[], allow: string[] | null): T[] {
  if (allow === null) return panels;
  return panels.filter((p) => allow.includes(p.name));
}

export function loadStoredSharedMeta(): SharedMeta | null {
  try {
    const raw = localStorage.getItem(SHARED_META_KEY);
    return raw ? parseSharedMeta(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function storeSharedMeta(meta: SharedMeta | null): void {
  try {
    if (!meta) return;
    // Sonar's taint tracker only recognizes a sanitizer at the exact
    // localStorage.setItem call site, so this rebuilds the object here
    // (field-by-field, statically) rather than delegating to
    // parseSharedMeta above -- keep the two in sync by hand.
    const settingsIn = meta.settings;
    const unitSystem =
      settingsIn?.unitSystem === 'si' || settingsIn?.unitSystem === 'us' ? settingsIn.unitSystem : undefined;
    let sampleLimit: number | 'all' | undefined;
    if (settingsIn?.sampleLimit === 'all') {
      sampleLimit = 'all';
    } else if (
      typeof settingsIn?.sampleLimit === 'number' &&
      Number.isFinite(settingsIn.sampleLimit) &&
      settingsIn.sampleLimit > 0
    ) {
      sampleLimit = settingsIn.sampleLimit;
    } else {
      sampleLimit = undefined;
    }
    const dateOrder =
      settingsIn?.dateOrder === 'asc' || settingsIn?.dateOrder === 'desc' ? settingsIn.dateOrder : undefined;

    const sanitized: SharedMeta = {};
    if (typeof meta.title === 'string' && meta.title.trim()) sanitized.title = meta.title;
    if (Array.isArray(meta.showPanels)) {
      sanitized.showPanels = meta.showPanels.filter((n): n is string => typeof n === 'string');
    }
    if (unitSystem !== undefined || sampleLimit !== undefined || dateOrder !== undefined) {
      sanitized.settings = { unitSystem, sampleLimit, dateOrder };
    }

    localStorage.setItem(SHARED_META_KEY, JSON.stringify(sanitized));
  } catch {
    // storage unavailable -- the meta is just re-fetched next visit
  }
}
