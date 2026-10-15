import { defineConfig } from 'vitest/config';

/**
 * @crewly/embed test config. Server code is tested in the default Node
 * environment; browser files opt into jsdom with a per-file
 * `@vitest-environment jsdom` comment. Worker count is capped because the
 * machine running Crewly is shared with live agents.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'example/**/*.test.ts'],
    maxWorkers: 2,
    minWorkers: 1,
  },
});
