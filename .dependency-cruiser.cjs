/** Module boundaries from ARCHITECTURE §2. Paths allow a prefix so tests/fixtures/boundaries can prove each rule. */
const FORBIDDEN_IN_SIM =
  '(^|/)node_modules/(three|react|react-dom|zustand|howler)/|^(three|react|react-dom|zustand|howler)(/|$)';

module.exports = {
  forbidden: [
    {
      name: 'sim-only-shared-content',
      severity: 'error',
      comment: 'packages/sim may import only packages/shared, packages/content and itself.',
      from: { path: '(^|/)packages/sim/' },
      to: { pathNot: '(^|/)packages/(sim|shared|content)/' },
    },
    {
      name: 'sim-no-presentation-libs',
      severity: 'error',
      comment: 'packages/sim must not reference three, react, zustand or howler (invariant 1).',
      from: { path: '(^|/)packages/sim/' },
      to: { path: FORBIDDEN_IN_SIM },
    },
    {
      name: 'ui-not-engine-internals',
      severity: 'error',
      comment: 'apps/web/src/ui talks to the engine through the store/bridge, not by importing engine modules.',
      from: { path: '(^|/)apps/web/src/ui/' },
      to: { path: '(^|/)apps/web/src/engine/' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(^|/)(dist|node_modules)/' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.base.json' },
    enhancedResolveOptions: { exportsFields: ['exports'], conditionNames: ['import', 'default'] },
  },
};
