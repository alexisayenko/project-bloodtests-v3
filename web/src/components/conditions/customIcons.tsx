import type { FC, SVGProps } from 'react';

/** Lucide-compatible icon component type. */
export type IconComponent = FC<SVGProps<SVGSVGElement> & { size?: number; strokeWidth?: number; color?: string }>;

/** Liver silhouette — stroke only, Lucide-style 24×24. */
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
    {/*
      Liver: roughly wedge-shaped organ, wide on the right, tapered on the left.
      Upper border convex, lower border concave (gallbladder notch), right lobe dominant.
    */}
    <path d="M3 10 C3 6 6 4 10 4 C14 4 19 5 20 9 C21 12 20 16 17 17.5 C14 19 10 18 8 16 C5 14 3 14 3 10 Z" />
  </svg>
);

/** Kidney bean — stroke only, Lucide-style 24×24. */
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
    {/*
      Kidney bean: oval outer shape with an indentation on the inner (medial) side.
      Hilum notch on the left-centre edge.
    */}
    <path d="M15 4 C18.5 4 21 7 21 12 C21 17 18.5 20 15 20 C12 20 10 18 9.5 16 C9 14.5 10 13.5 10 12 C10 10.5 9 9.5 9.5 8 C10 6 12 4 15 4 Z" />
    <path d="M9.5 8 C8 8.5 7 10 7 12 C7 14 8 15.5 9.5 16" />
  </svg>
);
