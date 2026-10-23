import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      { test: { name: 'sim', include: ['packages/sim/**/*.test.ts'], environment: 'node' } },
      { test: { name: 'shared', include: ['packages/shared/**/*.test.ts'], environment: 'node' } },
      {
        test: {
          name: 'repo',
          include: ['tests/**/*.test.ts', 'tools/**/*.test.ts'],
          exclude: ['tests/fixtures/**'],
          environment: 'node',
        },
      },
    ],
  },
});
