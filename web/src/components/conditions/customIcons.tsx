import type { FC, SVGProps } from 'react';

/** Lucide-compatible icon component type. */
export type IconComponent = FC<SVGProps<SVGSVGElement> & { size?: number; strokeWidth?: number; color?: string }>;

/**
 * Liver organ silhouette — exact vector extracted from design mockup.
 */
export const LiverIcon: IconComponent = ({ size = 26, color = 'currentColor', ...rest }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 32 27"
    fill="none"
    aria-hidden="true"
    {...rest}
  >
    <path
      d="M 26.25 1.00 L 32.00 1.25 L 32.00 11.00 L 26.25 16.00 L 23.25 17.00 L 22.25 16.25 L 22.25 1.75 L 23.25 1.00 L 26.25 1.00 Z M 13.00 0.00 L 19.00 1.00 L 20.25 2.25 L 20.00 18.25 L 16.75 21.00 L 11.00 23.00 L 6.25 27.00 L 1.75 27.00 L 1.00 25.50 L 0.75 16.75 L 0.00 16.00 L 0.00 7.75 L 2.25 3.50 L 4.50 1.50 L 7.00 0.75 L 7.25 0.00 Z"
      fill={color}
      fillRule="evenodd"
    />
  </svg>
);

/**
 * Kidney pair whose ureters join below them — a line icon in lucide's 24-unit
 * grid, since the mockup's traced polygon rendered as an unreadable blot.
 */
export const KidneyIcon: IconComponent = ({ size = 26, color = 'currentColor', strokeWidth = 2, ...rest }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...rest}
  >
    <path d="M6 3.2C2.9 2.6 1 5.6 1 10s1.9 7.4 5 6.8c1.9-.4 2.2-2.6 1-4-.7-.8-.7-4.8 0-5.6 1.2-1.4.9-3.6-1-4Z" />
    <path d="M18 3.2c3.1-.6 5 2.4 5 6.8s-1.9 7.4-5 6.8c-1.9-.4-2.2-2.6-1-4 .7-.8.7-4.8 0-5.6-1.2-1.4-.9-3.6 1-4Z" />
    <path d="M6.6 10c3.4.5 5.4 3 5.4 6.5V22M17.4 10c-3.4.5-5.4 3-5.4 6.5" />
  </svg>
);

/**
 * Capsule tilted lower-left to upper-right, split across its middle, with a
 * highlight arc under its upper cap — a line icon in lucide's 24-unit grid,
 * drawn upright and rotated so the cap, divider and arc stay concentric.
 */
export const PillIcon: IconComponent = ({ size = 24, color = 'currentColor', strokeWidth = 2, ...rest }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...rest}
  >
    <g transform="rotate(45 12 12)">
      <rect x="7" y="0" width="10" height="24" rx="5" />
      <path d="M7 12h10" />
      <path d="M9.84 4.75A2.5 2.5 0 0 1 12 3.5" />
    </g>
  </svg>
);

/**
 * Three hollow nodes in an inverted V, the top one linked to each bottom one
 * and the bottom pair unlinked — a line icon in lucide's 24-unit grid.
 */
export const PathwaysIcon: IconComponent = ({ size = 24, color = 'currentColor', strokeWidth = 2, ...rest }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...rest}
  >
    <circle cx="12" cy="5" r="3" />
    <circle cx="5" cy="19" r="3" />
    <circle cx="19" cy="19" r="3" />
    <path d="M10.66 7.68 6.34 16.32M13.34 7.68l4.32 8.64" />
  </svg>
);

/**
 * Thyroid gland butterfly outline — exact vector extracted from design mockup.
 */
export const ThyroidIcon: IconComponent = ({ size = 26, color = 'currentColor', ...rest }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 32 28"
    fill="none"
    aria-hidden="true"
    {...rest}
  >
    <path
      d="M 3.25 15.50 L 4.00 19.75 L 6.25 23.75 L 7.75 25.00 L 9.75 24.75 L 11.75 20.50 L 14.50 18.75 L 19.00 19.00 L 21.00 20.75 L 22.25 24.50 L 24.50 25.00 L 26.75 22.50 L 29.00 16.50 L 28.75 4.50 L 27.75 2.75 L 25.50 3.00 L 21.00 10.00 L 17.50 11.75 L 15.25 11.75 L 11.50 10.00 L 9.25 7.00 L 8.00 3.75 L 6.50 2.50 L 5.25 2.50 L 4.00 3.50 L 3.00 7.50 L 3.25 15.50 Z M 2.00 22.00 L 0.75 16.25 L 0.00 15.50 L 0.00 6.25 L 1.50 2.50 L 3.50 0.00 L 8.00 0.00 L 10.75 3.00 L 12.00 6.50 L 13.50 8.00 L 15.50 8.75 L 18.75 8.00 L 22.00 2.50 L 24.50 0.00 L 28.75 0.00 L 30.00 1.50 L 32.00 6.25 L 32.00 16.25 L 28.75 24.00 L 24.75 28.00 L 22.25 28.00 L 21.00 27.00 L 18.00 22.00 L 13.75 22.25 L 12.00 25.75 L 9.75 28.00 L 6.75 28.00 L 4.00 25.50 L 2.00 22.00 Z"
      fill={color}
      fillRule="evenodd"
    />
  </svg>
);
