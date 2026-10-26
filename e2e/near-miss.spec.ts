import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { parseReplay, parseTuning, ScoreReason, type Replay } from '@kometa/shared';
import { readEvents } from '../packages/sim/src/events';
import { Action } from '../packages/sim/src/input';
import { playReplay } from '../packages/sim/src/replay';
import { createSimState, SimStatus } from '../packages/sim/src/state';
import { step } from '../packages/sim/src/step';
import tuningJson from '../packages/content/tuning.default.json' with { type: 'json' };

const tuning = parseTuning(tuningJson).sim;
const digits = (text: string | null) => Number((text ?? '').replace(/\s/g, ''));

/** A separate Node run predicts exact observation ticks; browser inputs and stored replay must agree. */
function expectedRun() {
  const state = createSimState(1, tuning);
  const observations = new Map<number, { distance: number; total: number; pot: number }>();
  const near: { tick: number; vehicleType: number; slot: number }[] = [];
  const credits: { tick: number; reason: number; points: number }[] = [];
  const settlements: { tick: number; banked: number; lost: number }[] = [];
  let approach: { gap: number; rearToFront: number } | undefined;
  let sweptWitness: { entry: number; exit: number; penetration: number; gap: number; rearToFront: number } | undefined;
  for (let tick = 0; tick < 509; tick++) {
    step(state, tick === 350 ? Action.right : 0, tuning);
    for (const event of readEvents(state.events)) {
      if (event.kind === 'nearMiss') near.push({ tick: state.tick, vehicleType: event.vehicleType, slot: event.slot });
      if (event.kind === 'scoreAddedToPot')
        credits.push({ tick: state.tick, reason: event.reason, points: event.points });
      if (event.kind === 'scoreAddedDirect') throw new Error('unexpected direct award in near-pass scenario');
      if (event.kind === 'streakSettled')
        settlements.push({ tick: state.tick, banked: event.banked, lost: event.lost });
    }
    if ([350, 351, 356, 501, 506, 509].includes(state.tick)) {
      observations.set(state.tick, {
        distance: state.player.distanceM,
        total: state.score.total,
        pot: state.score.pot,
      });
    }
    if (state.tick === 351) {
      // The car approaches the corridor; qualifying proximity occurs inside the next swept tick.
      const van = tuning.vehicles[state.traffic.type[0] ?? 0];
      if (!van) throw new Error('expected van missing');
      const vanX = ((state.traffic.lane[0] ?? 0) - (tuning.lanes.count - 1) / 2) * tuning.lanes.widthM;
      const lateralGap = Math.abs(state.player.x - vanX) - (tuning.player.widthM + van.widthM) / 2;
      approach = {
        gap: lateralGap,
        rearToFront: state.player.z - tuning.player.lengthM / 2 - ((state.traffic.z[0] ?? 0) + van.lengthM),
      };
      expect(approach.gap).toBeGreaterThan(tuning.collision.nearMissLateralM);
      expect(approach.rearToFront).toBeLessThan(0);
      expect(near).toEqual([]);
    }
    if (state.tick === 352) {
      const van = tuning.vehicles[state.traffic.type[0] ?? 0];
      if (!van || !approach) throw new Error('missing close-pass approach');
      const vanX = ((state.traffic.lane[0] ?? 0) - (tuning.lanes.count - 1) / 2) * tuning.lanes.widthM;
      const gap = Math.abs(state.player.x - vanX) - (tuning.player.widthM + van.widthM) / 2;
      const rearToFront = state.player.z - tuning.player.lengthM / 2 - ((state.traffic.z[0] ?? 0) + van.lengthM);
      // Independent linear interpolation: enter the .6m corridor, then clear the van before lateral penetration.
      const entry = (approach.gap - tuning.collision.nearMissLateralM) / (approach.gap - gap);
      const exit = -approach.rearToFront / (rearToFront - approach.rearToFront);
      const penetration = approach.gap / (approach.gap - gap);
      expect(entry).toBeGreaterThan(0);
      expect(entry).toBeLessThan(exit);
      expect(exit).toBeLessThan(penetration);
      expect(penetration).toBeLessThan(1);
      const midpoint = (entry + exit) / 2;
      sweptWitness = {
        entry,
        exit,
        penetration,
        gap: approach.gap + (gap - approach.gap) * midpoint,
        rearToFront: approach.rearToFront + (rearToFront - approach.rearToFront) * midpoint,
      };
      expect(sweptWitness.gap).toBeGreaterThan(0);
      expect(sweptWitness.gap).toBeLessThan(tuning.collision.nearMissLateralM);
      expect(sweptWitness.rearToFront).toBeLessThan(0);
      expect(sweptWitness.rearToFront + van.lengthM + tuning.player.lengthM).toBeGreaterThan(0);
      expect(state.player.y).toBe(0);
      expect(Math.min(tuning.player.heightM, van.heightM)).toBeGreaterThan(0);
      expect(state.score).toMatchObject({ pot: 50, meter: 10, streakN: 1, streakTicksLeft: 150 });
    }
  }
  expect(near).toEqual([{ tick: 352, vehicleType: 3, slot: 0 }]);
  expect(credits).toEqual([{ tick: 352, reason: ScoreReason.nearMiss, points: 50 }]);
  expect(settlements).toEqual([{ tick: 502, banked: 50, lost: 0 }]);
  expect(state.status).toBe(SimStatus.crashed);
  expect(readEvents(state.events)).toContainEqual({ kind: 'crash', cause: 'rear' });
  expect(state.score.meter).toBe(10);
  expect(state.score.total).toBeCloseTo(state.player.distanceM * tuning.score.perMeter + 50, 9);
  return {
    observations,
    near,
    credits,
    settlements,
    sweptWitness,
    total: state.score.total,
    distance: state.player.distanceM,
  };
}

async function capture(page: Page, info: TestInfo, name: string) {
  await info.attach(name, {
    body: await page.screenshot({ path: info.outputPath(`${name}.png`) }),
    contentType: 'image/png',
  });
}

async function frames(page: Page, count: number) {
  // Each bounded long frame runs five actual production ticks, dropping excess accumulator backlog.
  for (let frame = 0; frame < count; frame++) await page.clock.fastForward(100);
}

async function right(page: Page, mobile: boolean) {
  if (!mobile) return page.keyboard.press('ArrowRight');
  await page.evaluate(() => {
    const canvas = document.getElementById('game');
    if (!canvas) throw new Error('canvas missing');
    const bounds = canvas.getBoundingClientRect();
    const start = {
      pointerId: 31,
      pointerType: 'touch',
      isPrimary: true,
      bubbles: true,
      clientX: bounds.left + bounds.width / 2,
      clientY: bounds.top + bounds.height / 2,
    };
    canvas.dispatchEvent(new PointerEvent('pointerdown', start));
    const end = { ...start, clientX: start.clientX + 60 };
    canvas.dispatchEvent(new PointerEvent('pointermove', end));
    canvas.dispatchEvent(new PointerEvent('pointerup', end));
  });
}

async function hidden(page: Page, value: boolean) {
  // Exercise the production visibility adapter; a data property avoids a transpiled getter in page.evaluate.
  await page.evaluate((hide) => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: hide });
    document.dispatchEvent(new Event('visibilitychange'));
  }, value);
}

async function savedRuns(page: Page): Promise<Replay[]> {
  const raw: unknown = JSON.parse(await page.evaluate(() => localStorage.getItem('kometa.replays.v1') ?? '[]'));
  if (!Array.isArray(raw)) throw new Error('replay list missing');
  return raw.map((run: unknown) => parseReplay(JSON.stringify(run), { maxTicks: 1000, maxDecompressedBytes: 100_000 }));
}

test('a real close pass banks into HUD, result and replay; hidden time and Retry stay isolated', async ({
  page,
  isMobile,
}, info) => {
  const expected = expectedRun();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('requestfailed', (request) => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
  await page.clock.install({ time: 1_000_000 });
  await page.clock.pauseAt(1_001_000);
  await page.addInitScript(() =>
    document.addEventListener('securitypolicyviolation', (event) => console.error(`CSP ${event.effectiveDirective}`)),
  );
  const response = await page.goto('/?seed=1&q=low&intro=0');
  const app = page.locator('#app');
  const hud = page.locator('.hud-score');
  const observe = async (tick: number) => {
    const target = expected.observations.get(tick);
    if (!target) throw new Error(`missing oracle observation ${tick}`);
    await expect(app).toHaveAttribute('data-screen', 'playing');
    await expect(hud).toBeVisible();
    expect(Number(await app.getAttribute('data-distance'))).toBe(Math.floor(target.distance));
    expect(digits(await hud.textContent())).toBe(Math.floor(target.total));
    return target;
  };
  await expect(app).toHaveAttribute('data-screen', 'playing');
  // No initial runFor: 70 five-step frames leave the next real input exactly at replay tick350.
  await frames(page, 70);
  await observe(350);
  await right(page, isMobile);
  // A 25ms frame after the dropped backlog integrates one tick, before completion at state.tick352.
  await page.clock.fastForward(25);
  expect((await observe(351)).pot).toBe(0);
  await capture(page, info, 'approach-before-completion');
  await frames(page, 1);
  expect((await observe(356)).pot).toBe(50);
  const pendingHud = await hud.textContent();
  const pendingDistance = await app.getAttribute('data-distance');
  await capture(page, info, 'near-miss-pending');
  await hidden(page, true);
  await page.clock.fastForward(5000);
  expect(await hud.textContent()).toBe(pendingHud);
  expect(await app.getAttribute('data-distance')).toBe(pendingDistance);
  await expect(app).toHaveAttribute('data-screen', 'playing');
  await hidden(page, false);
  await frames(page, 29); // tick501: the real pending pot still must not appear in the HUD.
  expect((await observe(501)).pot).toBe(50);
  await frames(page, 1); // tick506 lies inside the seven-tick bank502…508 / crash509 window.
  const banked = await observe(506);
  expect(banked.pot).toBe(0);
  expect(digits(await hud.textContent()) - Number(await app.getAttribute('data-distance'))).toBe(50);
  await capture(page, info, 'near-miss-banked-hud');
  await frames(page, 1);
  await expect(app).toHaveAttribute('data-screen', 'crashing');
  await frames(page, 8);
  await expect(app).toHaveAttribute('data-screen', 'results');
  await expect(page.locator('.results-score')).toBeVisible();
  const runs = await savedRuns(page);
  expect(runs).toHaveLength(1);
  const replay = runs[0];
  if (!replay) throw new Error('recorded run missing');
  expect(replay.seed).toBe(1);
  expect(replay.ticks).toBe(509);
  expect(replay.inputs).toEqual([
    [350, Action.right],
    [351, 0],
  ]);
  expect(replay.claimedDistanceM).toBe(expected.distance);
  expect(replay.claimedScore).toBe(Math.floor(expected.distance * tuning.score.perMeter + 50));
  const validation = playReplay(replay, tuning);
  expect(validation.valid, validation.reason).toBe(true);
  expect(validation.state.score.total).toBe(expected.total);
  expect(validation.hash).toBe('b3d301a4');
  expect(expected.total).toBeCloseTo(366.06451666705124, 9);
  expect(digits(await page.locator('.results-score').textContent())).toBe(366);
  expect(digits(await hud.textContent())).toBe(366);
  const best: unknown = JSON.parse(await page.evaluate(() => localStorage.getItem('kometa.best.v1') ?? 'null'));
  expect(best).toMatchObject({ schemaVersion: 1, score: 366, distanceM: expected.distance });
  await capture(page, info, 'near-miss-results');
  if (isMobile) await page.locator('.results-retry').tap();
  else await page.locator('.results-retry').click();
  await page.clock.runFor(32);
  await expect(app).toHaveAttribute('data-screen', 'playing');
  await expect(hud).toBeVisible();
  expect(digits(await hud.textContent())).toBeLessThan(5);
  expect(digits(await hud.textContent())).toBe(Number(await app.getAttribute('data-distance')));
  await capture(page, info, 'near-miss-retry-fresh');
  await frames(page, 31); // A complete old streak window cannot leak its previous 50 points into Retry.
  await expect(app).toHaveAttribute('data-screen', 'playing');
  expect(digits(await hud.textContent())).toBe(Number(await app.getAttribute('data-distance')));
  expect(await savedRuns(page)).toEqual(runs);
  await info.attach('near-miss-ledger', {
    body: JSON.stringify(
      {
        near: expected.near,
        credits: expected.credits,
        settlements: expected.settlements,
        sweptWitness: expected.sweptWitness,
        total: expected.total,
        display: 366,
        replay,
        hiddenVirtualMs: 5000,
        bankObservationTick: 506,
        retryOldWindowPassed: true,
      },
      null,
      2,
    ),
    contentType: 'application/json',
  });
  await info.attach('browser-diagnostics', {
    body: JSON.stringify(
      { errors, contentSecurityPolicy: response?.headers()['content-security-policy'] ?? null },
      null,
      2,
    ),
    contentType: 'application/json',
  });
  expect(errors).toEqual([]);
});
