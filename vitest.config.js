import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    exclude: ['node_modules', 'tests/e2e/**', 'test-results', 'playwright-report'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
      exclude: [
        // Browser-only modules — covered by Playwright E2E, not unit tests
        'src/main.js',
        'src/renderer.js',
      ],
      thresholds: {
        lines: 95,
        functions: 95,
        branches: 90,
        statements: 95,
      },
    },
  },
});
