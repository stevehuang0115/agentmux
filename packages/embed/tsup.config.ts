import { defineConfig } from 'tsup';

/**
 * Library build for @crewly/embed: one entry per subpath export, ESM (plus a
 * CJS copy for older Express apps) and .d.ts. React stays external.
 *
 * The React entry is built separately so it alone carries the `'use client'`
 * directive that Next.js App Router needs; server code must never carry it.
 * That entry skips rollup tree-shaking, which would strip the directive.
 * `dist/` is cleaned by the `build` script rather than here, because the two
 * configs run in parallel and one's clean would delete the other's output.
 */
const shared = {
  format: ['esm', 'cjs'] as ('esm' | 'cjs')[],
  dts: true,
  sourcemap: true,
  target: 'es2020',
  external: ['react', 'react-dom', 'node:crypto'],
  treeshake: true,
  clean: false,
};

export default defineConfig([
  {
    ...shared,
    entry: { server: 'src/server/index.ts', client: 'src/client/index.ts' },
  },
  {
    ...shared,
    entry: { react: 'src/react/index.ts' },
    treeshake: false,
    banner: { js: "'use client';" },
  },
]);
