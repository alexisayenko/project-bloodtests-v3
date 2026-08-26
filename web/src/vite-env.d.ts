/// <reference types="vite/client" />

// <lab-explore> is a plain custom element (see src/vendor/lab-explore/) --
// its .model property is set imperatively, not via a JSX prop, so this only
// needs to type-check as a bare host tag. React 19's automatic JSX runtime
// resolves IntrinsicElements from React's own JSX namespace (react/jsx-runtime
// re-exports it from "react"), not a bare global JSX namespace, so this
// augments the "react" module rather than `declare global`. `export {}` makes
// this file a module, so the augmentation merges instead of replacing "react".
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'lab-explore': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}
export {};
