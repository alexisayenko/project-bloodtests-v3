/**
 * The app's design tokens -- colour roles, type scale, radii, shadows and
 * spacing -- as references to the custom properties declared in
 * `styles/index.css` -- that `:root` block is the single source of truth for
 * the values, and this module is how the inline `style={{}}` objects the
 * codebase is written in reach them. A `var()` resolves anywhere a colour is
 * accepted, so a role can be repointed in one place; only the two chevron
 * data-URIs, which cannot interpolate a variable, carry a literal, and they
 * carry it in that same `:root` block.
 */
export const COLOR = {
  accent: 'var(--accent)',
  accentHover: 'var(--accent-hover)',
  accentSoft: 'var(--accent-soft)',
  accentLine: 'var(--accent-line)',

  text: 'var(--text)',
  textSecondary: 'var(--text-secondary)',
  textMuted: 'var(--text-muted)',
  textDisabled: 'var(--text-disabled)',
  textOnAccent: 'var(--text-on-accent)',

  surface: 'var(--surface)',
  surfaceMuted: 'var(--surface-muted)',
  surfaceSunken: 'var(--surface-sunken)',

  border: 'var(--border)',
  borderMuted: 'var(--border-muted)',
  borderSubtle: 'var(--border-subtle)',

  statusOk: 'var(--status-ok)',
  statusWarn: 'var(--status-warn)',
  statusBad: 'var(--status-bad)',
  statusOkBg: 'var(--status-ok-bg)',
  statusWarnBg: 'var(--status-warn-bg)',
  statusBadBg: 'var(--status-bad-bg)',
  statusOkBgSelected: 'var(--status-ok-bg-selected)',
  statusWarnBgSelected: 'var(--status-warn-bg-selected)',
  statusBadBgSelected: 'var(--status-bad-bg-selected)',
  statusOkText: 'var(--status-ok-text)',
  statusWarnText: 'var(--status-warn-text)',
  statusBadText: 'var(--status-bad-text)',
  statusNone: 'var(--status-none)',

  brandTeal: 'var(--brand-teal)',
  brandTealDeep: 'var(--brand-teal-deep)',
  navy: 'var(--navy)',
  primary: 'var(--primary)',
  primaryText: 'var(--primary-text)',
  link: 'var(--link)',
  surfacePage: 'var(--surface-page)',
  surfaceCard: 'var(--surface-card)',
  surfaceMint: 'var(--surface-mint)',

  chevronAccent: 'var(--chevron-accent)',
  chevronDisabled: 'var(--chevron-disabled)',
} as const;

/** Monitoring Panels identity tints, one role per hue family (`panelMeta.ts`). */
const tint = (role: string) => ({
  ink: `var(--tint-${role}-ink)`,
  bg: `var(--tint-${role}-bg)`,
  icon: `var(--tint-${role}-icon)`,
  line: `var(--tint-${role}-line)`,
});

export const TINT = {
  teal: tint('teal'),
  blue: tint('blue'),
  violet: tint('violet'),
  amber: tint('amber'),
  green: tint('green'),
  rose: tint('rose'),
  cyan: tint('cyan'),
  slate: tint('slate'),
  orange: tint('orange'),
  indigo: tint('indigo'),
  ochreInk: 'var(--tint-ochre-ink)',
  crimsonInk: 'var(--tint-crimson-ink)',
} as const;

export const FONT = {
  overline: 'var(--font-overline)',
  overlineWeight: 'var(--font-overline-weight)',
  overlineTracking: 'var(--font-overline-tracking)',
  body: 'var(--font-body)',
  small: 'var(--font-small)',
  cardTitle: 'var(--font-card-title)',
  cardTitleLg: 'var(--font-card-title-lg)',
  detailH1: 'var(--font-detail-h1)',
  displayH1: 'var(--font-display-h1)',
} as const;

export const RADIUS = {
  pill: 'var(--radius-pill)',
  card: 'var(--radius-card)',
  control: 'var(--radius-control)',
} as const;

export const SHADOW = {
  card: 'var(--shadow-card)',
  pop: 'var(--shadow-pop)',
} as const;

export const SPACE = {
  1: 'var(--space-1)',
  2: 'var(--space-2)',
  3: 'var(--space-3)',
  4: 'var(--space-4)',
  5: 'var(--space-5)',
  6: 'var(--space-6)',
} as const;
