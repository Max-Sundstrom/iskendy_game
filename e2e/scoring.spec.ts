import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { parseReplay, parseTuning, ScoreReason, type Replay } from '@kometa/shared';
import { readEvents } from '../packages/sim/src/events';
import { Action } from '../packages/sim/src/input';
import { playReplay } from '../packages/sim/src/replay';
import { createSimState, SimStatus } from '../packages/sim/src/state';
import { step } from '../packages/sim/src/step';
import tuningJson from '../packages/content/tuning.default.json' with { type: 'json' };

const tuning = parseTuning(tuningJson).sim;
const bank = tuning.score.slam + tuning.score.slam * (1 + tuning.streak.multiplierStep);
const digits = (text: string | null) => Number((text ?? '').replace(/\s/g, ''));

async function savedRuns(page: Page): Promise<Replay[]> {
  const raw: unknown = JSON.parse(await page.evaluate(() => localStorage.getItem('kometa.replays.v1') ?? '[]'));
  if (!Array.isArray(raw)) throw new Error('local replay list missing');
  return raw.map((value: unknown) =>
    parseReplay(JSON.stringify(value), { maxTicks: 1000, maxDecompressedBytes: 100_000 }),
  );
}

async function capture(page: Page, info: TestInfo, name: string) {
  await info.attach(name, {
    body: await page.screenshot({ path: info.outputPath(`${name}.png`) }),
    contentType: 'image/png',
  });
}

async function press(page: Page, mobile: boolean, action: 'jump' | 'slam') {
  if (!mobile) return page.keyboard.press(action === 'jump' ? 'Space' : 'ArrowDown');
  // Exercise the production touch adapter, not a sim/debug hook. Synthetic gestures do not prove phone hardware.
  await page.evaluate((down) => {
    const canvas = document.getElementById('game');
    if (!canvas) throw new Error('canvas missing');
    const bounds = canvas.getBoundingClientRect();
    const start = {
      pointerId: 23,
      pointerType: 'touch',
      isPrimary: true,
      bubbles: true,
      clientX: bounds.left + bounds.width / 2,
      clientY: bounds.top + bounds.height / 2,
    };
    canvas.dispatchEvent(new PointerEvent('pointerdown', start));
    const end = { ...start, clientY: start.clientY + (down ? 60 : 0) };
    if (down) canvas.dispatchEvent(new PointerEvent('pointermove', end));
    canvas.dispatchEvent(new PointerEvent('pointerup', end));
  }, action === 'slam');
}

async function frames(page: Page, count: number) {
  // A long frame runs at most five production sim ticks. This avoids rendering every 60-Hz intermediate frame.
  for (let frame = 0; frame < count; frame++) await page.clock.fastForward(100);
}

/** Independently audit source actions and their expected ledger, then validate the stored claim/hash. */
function audit(replay: Replay, expectedSlams: 0 | 2) {
  const state = createSimState(replay.seed, tuning);
  const slams: number[] = [];
  const credits: { reason: number; points: number }[] = [];
  const settlements: { tick: number; banked: number; lost: number }[] = [];
  let held = 0;
  let next = 0;
  for (let tick = 0; tick < replay.ticks; tick++) {
    const entry = replay.inputs[next];
    if (entry?.[0] === tick) {
      held = entry[1];
      next++;
    }
    step(state, held, tuning);
    for (const event of readEvents(state.events)) {
      if (event.kind === 'land' && event.slam) slams.push(state.tick);
      if (event.kind === 'scoreAddedToPot') credits.push(event);
      if (event.kind === 'scoreAddedDirect') throw new Error('unexpected direct award in two-slam scenario');
      if (event.kind === 'streakSettled') {
        settlements.push({ tick: state.tick, banked: event.banked, lost: event.lost });
      }
    }
  }
  expect(state.status).toBe(SimStatus.crashed);
  expect(slams).toHaveLength(expectedSlams);
  const expectedBank = expectedSlams === 2 ? bank : 0;
  if (expectedSlams === 2) {
    expect(bank).toBe(112.5);
    expect(credits.map(({ reason, points }) => ({ reason, points }))).toEqual([
      { reason: ScoreReason.slam, points: 50 },
      { reason: ScoreReason.slam, points: 62.5 },
    ]);
    expect(settlements).toEqual([
      {
        tick: (slams[1] ?? 0) + Math.ceil(tuning.streak.windowS * tuning.tickRateHz),
        banked: 112.5,
        lost: 0,
      },
    ]);
    expect(replay.inputs.some(([, mask]) => (mask & Action.jump) !== 0)).toBe(true);
    expect(replay.inputs.some(([, mask]) => (mask & Action.slam) !== 0)).toBe(true);
  } else {
    expect(replay.inputs).toEqual([]);
    expect(credits).toEqual([]);
    expect(settlements).toEqual([]);
  }
  // The independently calculated award is fractional. Do not floor each award or include an unbanked pot.
  const expectedTotal = state.player.distanceM * tuning.score.perMeter + expectedBank;
  expect(state.score.total).toBeCloseTo(expectedTotal, 9);
  expect(state.score.total).not.toBe(Math.floor(state.score.total));
  expect(replay.claimedScore).toBe(Math.floor(expectedTotal));
  const validation = playReplay(replay, tuning);
  expect(validation.valid, validation.reason).toBe(true);
  expect(validation.state.score.total).toBe(state.score.total);
  return { total: state.score.total, display: Math.floor(state.score.total), slams, settlements };
}

test('fractional slam streak banks into HUD, results and replay; Retry clears its score', async ({
  page,
  isMobile,
}, info) => {
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
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      console.error(`CSP ${event.disposition}: ${event.effectiveDirective}`);
    });
  });
  const response = await page.goto('/?seed=28&q=low&intro=0');
  await page.clock.runFor(32);
  const app = page.locator('#app');
  const hud = page.locator('.hud-score');
  await expect(app).toHaveAttribute('data-screen', 'playing');
  for (let slam = 0; slam < 2; slam++) {
    await press(page, isMobile, 'jump');
    await page.clock.runFor(50);
    await expect(app).toHaveAttribute('data-air', '1');
    await press(page, isMobile, 'slam');
    await page.clock.runFor(150);
    await expect(app).toHaveAttribute('data-air', '0');
  }
  await expect(hud).toBeVisible();
  expect(digits(await hud.textContent())).toBe(Number(await app.getAttribute('data-distance')));
  const pendingHud = await hud.textContent();
  const pendingDistance = await app.getAttribute('data-distance');
  // Headless tab switching is unreliable; exercise the actual visibility adapter used by an interrupted run.
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.fastForward(5000);
  await expect(app).toHaveAttribute('data-screen', 'playing');
  expect(await hud.textContent()).toBe(pendingHud);
  expect(await app.getAttribute('data-distance')).toBe(pendingDistance);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  // 160 ticks exceed the 150-tick timeout, while this fixed seed remains safely before its tick258 rear crash.
  await frames(page, 32);
  await expect(app).toHaveAttribute('data-screen', 'playing');
  const bankedHud = digits(await hud.textContent());
  const displayedDistance = Number(await app.getAttribute('data-distance'));
  expect([112, 113]).toContain(bankedHud - displayedDistance); // floor(d+112.5)−floor(d), never the raw pot
  await capture(page, info, 'fractional-bank-hud');

  // Continue ordinary production frames through the natural collision and short crash presentation.
  await frames(page, 24);
  await expect(app).toHaveAttribute('data-screen', 'results');
  await expect(page.locator('.results-score')).toBeVisible();
  const firstRuns = await savedRuns(page);
  expect(firstRuns).toHaveLength(1);
  const firstReplay = firstRuns[0];
  if (!firstReplay) throw new Error('first replay missing');
  expect(firstReplay.seed).toBe(28);
  expect(firstReplay.ticks).toBe(258);
  const first = audit(firstReplay, 2);
  expect(digits(await hud.textContent())).toBe(first.display);
  expect(digits(await page.locator('.results-score').textContent())).toBe(first.display);
  const best: unknown = JSON.parse(await page.evaluate(() => localStorage.getItem('kometa.best.v1') ?? 'null'));
  expect(best).toMatchObject({ schemaVersion: 1, score: first.display, distanceM: firstReplay.claimedDistanceM });
  await capture(page, info, 'fractional-bank-results');

  if (isMobile) await page.locator('.results-retry').tap();
  else await page.locator('.results-retry').click();
  await page.clock.runFor(32);
  await expect(app).toHaveAttribute('data-screen', 'playing');
  await expect(hud).toBeVisible();
  expect(digits(await hud.textContent())).toBe(Number(await app.getAttribute('data-distance')));
  expect(digits(await hud.textContent())).toBeLessThan(5);
  expect(await savedRuns(page)).toEqual(firstRuns);
  await capture(page, info, 'retry-fresh-score');
  // Seed29 has a natural rear crash at tick505. This idle retry must receive no unsolicited input or score.
  await frames(page, 112);
  await expect(app).toHaveAttribute('data-screen', 'results');
  await expect(page.locator('.results-score')).toBeVisible();
  const finalRuns = await savedRuns(page);
  expect(finalRuns).toHaveLength(2);
  expect(finalRuns[0]).toEqual(firstReplay);
  const secondReplay = finalRuns[1];
  if (!secondReplay) throw new Error('retry replay missing');
  expect(secondReplay.seed).toBe(29);
  expect(secondReplay.ticks).toBe(505);
  const second = audit(secondReplay, 0);
  expect(digits(await page.locator('.results-score').textContent())).toBe(second.display);
  expect(digits(await hud.textContent())).toBe(second.display);
  const finalBest: unknown = JSON.parse(await page.evaluate(() => localStorage.getItem('kometa.best.v1') ?? 'null'));
  const winningReplay = second.display > first.display ? secondReplay : firstReplay;
  expect(finalBest).toMatchObject({
    schemaVersion: 1,
    score: Math.max(first.display, second.display),
    distanceM: winningReplay.claimedDistanceM,
  });
  await info.attach('score-ledger', {
    body: JSON.stringify({ first, second }, null, 2),
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
