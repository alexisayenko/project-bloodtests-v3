import type { FC, SVGProps } from 'react';

/** Lucide-compatible icon component type. */
export type IconComponent = FC<SVGProps<SVGSVGElement> & { size?: number; strokeWidth?: number; color?: string }>;

/**
 * Liver organ silhouette — filled shape with anatomical lobe divider,
 * matching media_1789067706421.png.
 */
export const LiverIcon: IconComponent = ({ size = 24, color = 'currentColor', ...rest }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    {...rest}
  >
    {/* Main liver mass (filled) with lobe contour */}
    <path
      d="M3 11 C3 6.8 6.5 4.5 12 4.5 C17 4.5 21 6.5 21 11 C21 15 17.5 19.5 13 19.5 C8 19.5 4.5 17 3.5 14 C3.2 13 3 12 3 11 Z"
      fill={color}
    />
    {/* Fine anatomical division line between right and left lobes */}
    <path
      d="M13.5 4.8 C13 9 13.8 14 15 19.2"
      stroke="#ffffff"
      strokeWidth={1.4}
      strokeLinecap="round"
      fill="none"
    />
  </svg>
);

/**
 * Kidney pair with renal pelvis & ureters,
 * matching media_1789067706421.png.
 */
export const KidneyIcon: IconComponent = ({ size = 24, strokeWidth = 2, color = 'currentColor', ...rest }) => (
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
    {/* Left kidney */}
    <path d="M10 5.5 C7.5 4.8 5 6.5 4.5 9.5 C4 13 5.5 16.5 8 18 C9.8 19 11.5 18 11.5 16 C11.5 14.5 10.8 13.8 10.8 12 C10.8 10.2 11.5 9.5 11.5 7.8 C11.5 6.4 10.8 5.7 10 5.5 Z" />
    {/* Left ureter */}
    <path d="M10.5 14.5 V19.5" />

    {/* Right kidney */}
    <path d="M14 5.5 C16.5 4.8 19 6.5 19.5 9.5 C20 13 18.5 16.5 16 18 C14.2 19 12.5 18 12.5 16 C12.5 14.5 13.2 13.8 13.2 12 C13.2 10.2 12.5 9.5 12.5 7.8 C12.5 6.4 13.2 5.7 14 5.5 Z" />
    {/* Right ureter */}
    <path d="M13.5 14.5 V19.5" />
  </svg>
);

/**
 * Thyroid gland butterfly outline with symmetrical lobes & isthmus,
 * matching media_1789067706421.png.
 */
export const ThyroidIcon: IconComponent = ({ size = 24, strokeWidth = 2, color = 'currentColor', ...rest }) => (
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
    <path d="M7 6 C5 6 4 8 4 11.5 C4 15 5.5 18 8 18 C10 18 11 16.5 12 15 C13 16.5 14 18 16 18 C18.5 18 20 15 20 11.5 C20 8 19 6 17 6 C15 6 13.5 8 13.2 10.5 C13 12 11 12 10.8 10.5 C10.5 8 9 6 7 6 Z" />
  </svg>
);
