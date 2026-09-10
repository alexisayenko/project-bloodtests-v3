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
 * Kidney pair with ureters — exact vector extracted from design mockup.
 */
export const KidneyIcon: IconComponent = ({ size = 26, color = 'currentColor', ...rest }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 27 31"
    fill="none"
    aria-hidden="true"
    {...rest}
  >
    <path
      d="M 24.00 13.75 L 22.75 15.75 L 23.00 19.75 L 24.25 21.00 L 27.00 21.25 L 27.00 24.00 L 24.00 23.75 L 21.75 21.75 L 20.75 21.75 L 21.00 28.75 L 20.00 30.25 L 18.75 30.75 L 18.00 29.75 L 18.00 17.00 L 19.25 12.75 L 20.75 11.75 L 20.75 10.50 L 19.00 8.00 L 19.00 3.00 L 21.50 0.00 L 27.00 0.00 L 27.00 2.50 L 23.25 2.00 L 21.75 3.50 L 22.00 8.00 L 24.25 11.00 L 24.00 13.75 Z M 8.75 24.75 L 10.50 24.25 L 12.00 22.25 L 12.00 20.00 L 9.75 18.00 L 9.75 16.50 L 10.75 15.75 L 10.25 12.75 L 13.00 10.25 L 13.00 7.25 L 10.75 5.25 L 8.00 5.50 L 5.50 7.25 L 3.75 10.00 L 2.50 14.75 L 2.75 18.50 L 4.25 22.50 L 6.25 24.25 L 8.75 24.75 Z M 16.00 16.50 L 16.25 30.00 L 15.75 31.00 L 14.75 31.00 L 14.00 30.00 L 13.50 25.25 L 11.00 27.00 L 7.75 27.50 L 4.00 26.00 L 1.75 23.50 L 0.00 20.00 L 0.00 11.25 L 2.25 7.00 L 5.25 4.00 L 8.25 2.75 L 12.25 3.00 L 14.00 4.00 L 15.75 7.00 L 15.75 10.25 L 14.25 14.50 L 15.75 15.25 L 16.00 16.50 Z"
      fill={color}
      fillRule="evenodd"
    />
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
