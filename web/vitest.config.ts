import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**'],
      // Reached only from the chart view layer, which the coverage metric
      // skips anyway — matches the Sonar coverage exclusions.
      exclude: ['src/utils/analysis.ts'],
    },
  },
});
