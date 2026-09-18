/// <reference types="vite/client" />

// Injected by vite.config.ts `define` at build time.
declare global {
  const __BUILD_COMMIT__: string;
  const __BUILD_TIME__: string;
}

// React 19 resolves IntrinsicElements from the "react" module's JSX namespace,
// not a global one, so the custom element is declared here; `export {}` keeps
// this a module so the augmentation merges rather than replaces.
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'lab-explore': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}
export {};
