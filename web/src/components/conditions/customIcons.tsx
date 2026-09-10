import type { FC, SVGProps } from 'react';

/** Lucide-compatible icon component type. */
export type IconComponent = FC<SVGProps<SVGSVGElement> & { size?: number; strokeWidth?: number; color?: string }>;

/** Liver silhouette — matching stroke style. */
export const LiverIcon: IconComponent = ({ size = 24, strokeWidth = 1.75, color = 'currentColor', ...rest }) => (
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
    <path d="M4 11 C4 6.5 7 4 12 4 C17 4 20 6.5 20 10.5 C20 14.5 17 19 13.5 19 C10 19 7 17 5 14.5 C4.3 13.5 4 12.3 4 11 Z" />
    <path d="M12 4 C12 8 13.5 12 16 14" />
  </svg>
);

/** Kidney bean pair / renal icon. */
export const KidneyIcon: IconComponent = ({ size = 24, strokeWidth = 1.75, color = 'currentColor', ...rest }) => (
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
    <path d="M10 5 C6.5 5 4 8 4 12 C4 16 6.5 19 10 19 C12 19 13 17.5 13 16 C13 14.5 12.5 13.5 12.5 12 C12.5 10.5 13 9.5 13 8 C13 6.5 12 5 10 5 Z" />
    <path d="M14 5 C17.5 5 20 8 20 12 C20 16 17.5 19 14 19 C12 19 11 17.5 11 16 C11 14.5 11.5 13.5 11.5 12 C11.5 10.5 11 9.5 11 8 C11 6.5 12 5 14 5 Z" />
  </svg>
);

/** Thyroid butterfly / lobes icon. */
export const ThyroidIcon: IconComponent = ({ size = 24, strokeWidth = 1.75, color = 'currentColor', ...rest }) => (
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
    <path d="M7 5 C5 5 4 8 4 12 C4 16 5.5 19 8 19 C10 19 11 17 12 15 C13 17 14 19 16 19 C18.5 19 20 16 20 12 C20 8 19 5 17 5 C15 5 13.5 8 13.5 11 C13 12 11 12 10.5 11 C10.5 8 9 5 7 5 Z" />
  </svg>
);
