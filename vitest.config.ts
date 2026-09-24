import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // All tested logic is pure, so no DOM environment is needed.
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
