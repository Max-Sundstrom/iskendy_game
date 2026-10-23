import { execFileSync } from 'node:child_process';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

// ARCHITECTURE §2: each boundary rule has a fixture that must fail, so a broken rule can't pass silently.
const FIXTURES = 'tests/fixtures/boundaries';

type CruiseViolation = { rule: { name: string }; from: string; to: string };

function cruiseFixtures(): CruiseViolation[] {
  const bin = process.platform === 'win32' ? 'depcruise.cmd' : 'depcruise';
  let output: string;
  try {
    output = execFileSync(
      `node_modules/.bin/${bin}`,
      [FIXTURES, '--config', '.dependency-cruiser.cjs', '--output-type', 'json'],
      {
        encoding: 'utf8',
      },
    );
  } catch (error) {
    // depcruise exits non-zero when it finds violations; the JSON report is still on stdout.
    output = (error as { stdout: string }).stdout;
  }
  const report = JSON.parse(output) as { summary: { violations: CruiseViolation[] } };
  return report.summary.violations;
}

describe('dependency-cruiser boundaries', () => {
  const violations = cruiseFixtures();
  const byRule = (name: string) => violations.filter((v) => v.rule.name === name).map((v) => `${v.from} -> ${v.to}`);

  it('rejects sim importing a presentation library', () => {
    expect(byRule('sim-no-presentation-libs')).toEqual([`${FIXTURES}/packages/sim/src/imports-three.ts -> three`]);
  });

  it('rejects sim importing anything outside sim, shared and content', () => {
    expect(byRule('sim-only-shared-content')).toEqual(
      expect.arrayContaining([
        `${FIXTURES}/packages/sim/src/imports-three.ts -> three`,
        `${FIXTURES}/packages/sim/src/imports-web.ts -> ${FIXTURES}/apps/web/src/engine/renderer.ts`,
      ]),
    );
  });

  it('rejects UI importing engine internals', () => {
    expect(byRule('ui-not-engine-internals')).toEqual([
      `${FIXTURES}/apps/web/src/ui/imports-engine.ts -> ${FIXTURES}/apps/web/src/engine/renderer.ts`,
    ]);
  });
});

describe('sim determinism lint rules', () => {
  it('reports Math.random, transcendental Math, Date and performance in sim code', async () => {
    const eslint = new ESLint({ ignore: false });
    const [result] = await eslint.lintFiles([`${FIXTURES}/packages/sim/src/non-deterministic.ts`]);
    const ruleIds = (result?.messages ?? []).map((m) => `${m.line}:${m.ruleId}`);
    expect(ruleIds).toEqual([
      '2:no-restricted-properties',
      '3:no-restricted-properties',
      '4:no-restricted-globals',
      '5:no-restricted-globals',
    ]);
  });
});
