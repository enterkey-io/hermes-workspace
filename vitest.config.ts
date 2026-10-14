import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/**/*.test.ts', 'test/integration/**/*.test.ts'],
    environment: 'node',
    restoreMocks: true,
  },
});
