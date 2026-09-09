/**
 * The app's colour roles, as references to the custom properties declared in
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

  chevronAccent: 'var(--chevron-accent)',
  chevronDisabled: 'var(--chevron-disabled)',
} as const;
