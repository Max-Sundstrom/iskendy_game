import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { parseReplay, parseTuning } from '@kometa/shared';
import { playReplay } from '../packages/sim/src/replay';
import { readEvents } from '../packages/sim/src/events';
import tuningJson from '../packages/content/tuning.default.json' with { type: 'json' };

const simTuning = parseTuning(tuningJson).sim;

// J12/J14/P1: real simulated collisions, a visible presentation interval, then results; no sim injection.
const savedRuns = (page: Page) => page.evaluate(() => localStorage.getItem('kometa.replays.v1') ?? '[]');
const capture = async (page: Page, info: TestInfo, name: string) => {
  const image = await page.screenshot({ path: info.outputPath(`${name}.png`) });
  await info.attach(name, { body: image, contentType: 'image/png' });
  return image;
};
const start = async (page: Page, seed: number) => {
  await page.clock.install({ time: 1_000_000 });
  await page.clock.pauseAt(1_001_000);
  await page.goto(`/?seed=${seed}&q=low&intro=0`);
  await page.clock.runFor(32);
  await expect(page.locator('#app')).toHaveAttribute('data-screen', 'playing');
};
const reachCrash = async (page: Page) => {
  // Bounded low-frame-rate catch-up frames run the production loop (at most five sim ticks each).
  // Stop on the first crash frame so even slow CI rendering cannot skip its presentation interval.
  for (let frame = 0; frame < 150; frame++) {
    if ((await page.locator('#app').getAttribute('data-screen')) === 'crashing') return;
    await page.clock.fastForward(100);
  }
  await expect(page.locator('#app')).toHaveAttribute('data-screen', 'crashing');
};
const finishCrash = async (page: Page) => {
  // Keep the same 800 ms horizon with eight real frames below the production 250 ms frame clamp.
  // The impact/visibility/reduced-motion checks retain their fine-grained animation frames.
  for (let frame = 0; frame < 8; frame++) await page.clock.fastForward(100);
};
const hidden = async (page: Page, value: boolean) => {
  // Exercise the actual visibility adapter; headless browsers do not reliably hide a tab on bringToFront.
  await page.evaluate((hide) => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hide });
    document.dispatchEvent(new Event('visibilitychange'));
  }, value);
};
const jump = async (page: Page, mobile: boolean) => {
  if (!mobile) return page.keyboard.press('Space');
  await page.evaluate(() => {
    const canvas = document.getElementById('game');
    if (!canvas) throw new Error('no canvas');
    const r = canvas.getBoundingClientRect();
    const init = {
      pointerId: 9,
      pointerType: 'touch',
      clientX: r.width / 2,
      clientY: r.height / 2,
      isPrimary: true,
      bubbles: true,
    };
    canvas.dispatchEvent(new PointerEvent('pointerdown', init));
    canvas.dispatchEvent(new PointerEvent('pointerup', init));
  });
};

test('crash freezes the run, pauses while hidden and records once across two retries', async ({
  page,
  isMobile,
}, info) => {
  await start(page, 96);
  const app = page.locator('#app');
  for (let run = 0; run < 3; run++) {
    await reachCrash(page);
    await expect(page.locator('.crash-cue')).toBeVisible();
    await expect(page.locator('.results')).toBeHidden();
    const saved = await savedRuns(page);
    const runs: unknown = JSON.parse(saved);
    expect(Array.isArray(runs)).toBe(true);
    if (!Array.isArray(runs)) throw new Error('replay list missing');
    expect(runs).toHaveLength(run + 1);
    const replay = parseReplay(JSON.stringify(runs[run]), { maxTicks: 1000, maxDecompressedBytes: 100_000 });
    expect(replay.seed).toBe(96 + run);
    expect(replay.ticks).toBe([339, 324, 313][run]);
    expect(playReplay(replay, simTuning).valid).toBe(true);
    const distance = await app.getAttribute('data-distance');
    if (run === 0) {
      await capture(page, info, 'impact-start');
      await page.clock.runFor(125);
      await capture(page, info, 'impact-settle');
      await hidden(page, true);
      const before = await page.locator('#game').screenshot();
      await page.clock.fastForward(5_000);
      expect(await page.locator('#game').screenshot()).toEqual(before);
      await expect(app).toHaveAttribute('data-screen', 'crashing');
      await hidden(page, false);
      // The OS preference can change after impact. Removing motion must freeze even a previously animated scene.
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.clock.runFor(32);
      const reduced = await page.locator('#game').screenshot();
      await page.clock.runFor(32);
      expect(await page.locator('#game').screenshot()).toEqual(reduced);
      await capture(page, info, 'reduced-after-impact');
      await page.keyboard.press('Space');
      await page.keyboard.press('ArrowRight');
    }
    await finishCrash(page);
    await expect(app).toHaveAttribute('data-screen', 'results');
    await expect(page.locator('.crash-cue')).toBeHidden();
    await expect(page.locator('.results-retry')).toBeFocused();
    await expect(app).toHaveAttribute('data-distance', distance ?? '');
    expect(await savedRuns(page)).toBe(saved);
    await capture(page, info, `results-${run + 1}`);
    if (run < 2) {
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      if (isMobile) await page.locator('.results-retry').tap();
      else await page.locator('.results-retry').click();
      await page.clock.runFor(32);
      await expect(app).toHaveAttribute('data-screen', 'playing');
      await expect(page.locator('.crash-cue')).toBeHidden();
      await expect(page.locator('.results')).toBeHidden();
      expect(Number(await app.getAttribute('data-distance'))).toBeLessThan(5);
    }
  }
});

test('reduced motion keeps the crash scene static before results', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await start(page, 28);
  await reachCrash(page);
  await expect(page.locator('.crash-cue')).toBeVisible();
  await capture(page, info, 'reduced-impact-start');
  const before = await page.locator('#game').screenshot();
  await page.clock.runFor(125);
  expect(await page.locator('#game').screenshot()).toEqual(before);
  await capture(page, info, 'reduced-impact-settle');
  await finishCrash(page);
  await expect(page.locator('#app')).toHaveAttribute('data-screen', 'results');
  await capture(page, info, 'reduced-results');
});

test('a late real flip shows its bad landing orientation before results', async ({ page, isMobile }, info) => {
  await start(page, 5);
  await page.clock.runFor(218);
  await jump(page, isMobile);
  await page.clock.runFor(500);
  await expect(page.locator('#app')).toHaveAttribute('data-air', '1');
  await jump(page, isMobile);
  await page.clock.runFor(350);
  await expect(page.locator('#app')).toHaveAttribute('data-screen', 'crashing');
  await expect(page.locator('.results')).toBeHidden();
  const raw: unknown = JSON.parse(await savedRuns(page));
  if (!Array.isArray(raw)) throw new Error('replay list missing');
  expect(raw).toHaveLength(1);
  const replay = parseReplay(JSON.stringify(raw[0]), { maxTicks: 1000, maxDecompressedBytes: 100_000 });
  const result = playReplay(replay, simTuning);
  expect(result.valid).toBe(true);
  expect(readEvents(result.state.events)).toContainEqual({ kind: 'crash', cause: 'landing' });
  await capture(page, info, 'landing-impact');
  await finishCrash(page);
  await expect(page.locator('#app')).toHaveAttribute('data-screen', 'results');
  await capture(page, info, 'landing-results');
});
