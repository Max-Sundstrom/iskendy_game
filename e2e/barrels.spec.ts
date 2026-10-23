import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { parseReplay, parseTuning } from '@kometa/shared';
import { playReplay } from '../packages/sim/src/replay';
import { readEvents } from '../packages/sim/src/events';
import tuningJson from '../packages/content/tuning.default.json' with { type: 'json' };

const tuning = parseTuning(tuningJson).sim;

// G6/G11 presentation: real input adapters, fixed-step sim and renderer. The clock controls observation only.
const start = async (page: Page) => {
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
  await page.goto('/?seed=5&q=low&intro=0');
  await page.clock.runFor(250);
  await expect(page.locator('#app')).toHaveAttribute('data-screen', 'playing');
  return errors;
};

const input = async (page: Page, mobile: boolean, direction: -1 | 0 | 1) => {
  if (!mobile) return page.keyboard.press(direction === 0 ? 'Space' : direction < 0 ? 'ArrowLeft' : 'ArrowRight');
  // A complete tap/swipe in one task preserves gesture timing on a software renderer.
  await page.evaluate((dir) => {
    const canvas = document.getElementById('game');
    if (!canvas) throw new Error('no canvas');
    const r = canvas.getBoundingClientRect();
    const init = {
      pointerId: 12,
      pointerType: 'touch',
      isPrimary: true,
      bubbles: true,
      clientX: r.left + r.width / 2,
      clientY: r.top + r.height / 2,
    };
    canvas.dispatchEvent(new PointerEvent('pointerdown', init));
    const end = { ...init, clientX: init.clientX + dir * 60 };
    if (dir !== 0) canvas.dispatchEvent(new PointerEvent('pointermove', end));
    canvas.dispatchEvent(new PointerEvent('pointerup', end));
  }, direction);
};

const capture = async (page: Page, info: TestInfo, name: string) => {
  const body = await page.screenshot({ path: info.outputPath(`${name}.png`) });
  await info.attach(name, { body, contentType: 'image/png' });
};
const angle = async (page: Page) => Number(await page.locator('#app').getAttribute('data-roll'));

for (const direction of [-1, 1] as const) {
  const side = direction < 0 ? 'left' : 'right';
  test(`a ${side} barrel visibly completes a full turn and lands safely`, async ({ page, isMobile }, info) => {
    const errors = await start(page);
    const app = page.locator('#app');
    await input(page, isMobile, 0);
    await page.clock.runFor(50);
    await expect(app).toHaveAttribute('data-air', '1');
    await input(page, isMobile, direction);
    await page.clock.runFor(100);
    expect(direction * (await angle(page))).toBeGreaterThan(0.18);
    expect(direction * (await angle(page))).toBeLessThan(0.3);
    await capture(page, info, `${side}-quarter`);
    await page.clock.runFor(125);
    expect(direction * (await angle(page))).toBeGreaterThan(0.45);
    expect(direction * (await angle(page))).toBeLessThan(0.6);
    await capture(page, info, `${side}-inverted`);
    await page.clock.runFor(125);
    expect(direction * (await angle(page))).toBeGreaterThan(0.7);
    await capture(page, info, `${side}-three-quarter`);
    await page.clock.runFor(125);
    await expect(app).toHaveAttribute('data-roll', direction < 0 ? '-1.00' : '1.00');
    await expect(app).toHaveAttribute('data-air', '1');
    await capture(page, info, `${side}-complete`);
    await page.clock.runFor(400);
    await expect(app).toHaveAttribute('data-roll', '0.00');
    await expect(app).toHaveAttribute('data-air', '0');
    await expect(app).toHaveAttribute('data-screen', 'playing');
    await capture(page, info, `${side}-safe-landing`);
    expect(errors).toEqual([]);
  });

  test(`a late mixed ${side} roll preserves its impact pose and Retry clears it`, async ({ page, isMobile }, info) => {
    const errors = await start(page);
    const app = page.locator('#app');
    await input(page, isMobile, 0);
    await page.clock.runFor(500);
    await expect(app).toHaveAttribute('data-air', '1');
    await input(page, isMobile, 0);
    await input(page, isMobile, direction);
    await page.clock.runFor(350);
    await expect(app).toHaveAttribute('data-screen', 'crashing');
    await expect(page.locator('.results')).toBeHidden();
    const raw: unknown = JSON.parse(await page.evaluate(() => localStorage.getItem('kometa.replays.v1') ?? '[]'));
    if (!Array.isArray(raw)) throw new Error('replay list missing');
    expect(raw).toHaveLength(1);
    const replay = parseReplay(JSON.stringify(raw[0]), { maxTicks: 1000, maxDecompressedBytes: 100_000 });
    const result = playReplay(replay, tuning);
    expect(result.valid).toBe(true);
    expect(readEvents(result.state.events)).toContainEqual({ kind: 'crash', cause: 'landing' });
    expect(result.state.player.flipTurns).toBeGreaterThan(0.4);
    expect(direction * result.state.player.rollTurns).toBeGreaterThan(0.5);
    await expect(app).toHaveAttribute('data-flip', result.state.player.flipTurns.toFixed(2));
    await expect(app).toHaveAttribute('data-roll', result.state.player.rollTurns.toFixed(2));
    await capture(page, info, `${side}-mixed-impact`);
    await page.clock.runFor(800);
    await expect(app).toHaveAttribute('data-screen', 'results');
    if (isMobile) await page.locator('.results-retry').tap();
    else await page.locator('.results-retry').click();
    await page.clock.runFor(32);
    await expect(app).toHaveAttribute('data-screen', 'playing');
    await expect(app).toHaveAttribute('data-roll', '0.00');
    await expect(app).toHaveAttribute('data-flip', '0.00');
    await capture(page, info, `${side}-retry-upright`);
    await input(page, isMobile, 0);
    await page.clock.runFor(50);
    await input(page, isMobile, direction === -1 ? 1 : -1);
    await page.clock.runFor(125);
    expect(direction * (await angle(page))).toBeLessThan(-0.2);
    await capture(page, info, `${side}-retry-opposite-roll`);
    expect(errors).toEqual([]);
  });
}
