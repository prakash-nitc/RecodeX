/// <reference types="vite/client" />

declare module 'virtual:recodex-art' {
  /** Images found in /public/art at build time, keyed by sky phase (dawn, day, dusk, night) or "hero". */
  const files: Record<string, string>;
  export default files;
}
