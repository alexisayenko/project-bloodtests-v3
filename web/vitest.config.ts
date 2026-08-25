import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**'],
      // Legacy pre-nav flow, not wired into App.tsx (see CLAUDE.md) — matches
      // the eslint and Sonar exclusions.
      exclude: [
        'src/components/layout/**',
        'src/components/panels/**',
        'src/components/results/**',
        'src/components/upload/**',
        'src/components/analytics/**',
      ],
    },
  },
});
