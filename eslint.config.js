import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Engine-dependent Math functions and clocks are banned in the sim (invariant 2); use sim/math.ts LUTs.
const NON_DETERMINISTIC_MATH = ['random', 'sin', 'cos', 'tan', 'atan2', 'exp', 'pow', 'log'].map((property) => ({
  object: 'Math',
  property,
  message: 'Non-deterministic across JS engines; use the seeded RNG or the LUTs in sim/math.ts (invariant 2).',
}));

export const simRules = {
  'no-restricted-properties': ['error', ...NON_DETERMINISTIC_MATH],
  'no-restricted-globals': [
    'error',
    ...[
      'Date',
      'performance',
      'window',
      'document',
      'navigator',
      'requestAnimationFrame',
      'setTimeout',
      'setInterval',
    ].map((name) => ({ name, message: 'The sim has no clocks, timers or DOM (invariants 1-2).' })),
  ],
  'no-restricted-imports': [
    'error',
    {
      patterns: [
        {
          group: ['three', 'three/*', 'react', 'react/*', 'react-dom', 'react-dom/*', 'zustand', 'zustand/*', 'howler'],
          message: 'The sim must not depend on rendering, UI or audio (invariant 1).',
        },
      ],
    },
  ],
};

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/dist/**', 'playwright-report/**', 'test-results/**', 'tests/fixtures/**'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: { globals: { ...globals.es2022 } },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  { files: ['**/*.cjs'], languageOptions: { sourceType: 'commonjs', globals: { ...globals.node } } },
  { files: ['apps/*/src/**/*.ts'], languageOptions: { globals: { ...globals.browser } } },
  { files: ['deploy/disabled/*.js'], languageOptions: { sourceType: 'script', globals: { ...globals.browser } } },
  {
    files: ['*.{js,ts}', 'tests/**/*.ts', 'e2e/**/*.ts', 'tools/**/*.ts', 'apps/*/vite.config.ts'],
    languageOptions: { globals: { ...globals.node } },
  },
  { files: ['**/packages/sim/**/*.ts'], rules: simRules },
  // Tests compare the sim against Math.exp & co.; the rules above still apply to sim sources.
  { files: ['**/packages/sim/**/*.test.ts'], rules: { 'no-restricted-properties': 'off' } },
);
