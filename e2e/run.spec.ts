import { expect, test } from '@playwright/test';

// P1-05 acceptance and scenario J14: start → crash → results with score and promo code → Retry, on both viewports.
// Seed 28 crashes within ~4 s when idle (found by scanning seeds), so the run ends without input.

test('a run ends on a crash, shows the results and retries', async ({ page }) => {
  await page.goto('/?seed=28&q=low');
  const app = page.locator('#app');
  await expect(app).toHaveAttribute('data-screen', 'intro');
  await expect(app).toHaveAttribute('data-screen', 'playing', { timeout: 20_000 });
  await expect(app).toHaveAttribute('data-screen', 'results', { timeout: 60_000 });
  await expect(page.locator('.results-score')).toHaveText(/^\d[\d\s]*$/); // digits grouped by narrow no-break spaces
  await expect(page.locator('.results-code')).toHaveText(/^ISK-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
  const retry = page.locator('.results-retry');
  await expect(retry).toBeFocused();
  await retry.click();
  // Retry replays the short end of the launch ramp (GDD §3) before the run.
  await expect(app).toHaveAttribute('data-screen', /intro|playing/);
  await expect(app).toHaveAttribute('data-screen', 'playing', { timeout: 20_000 });
  await expect.poll(async () => Number(await app.getAttribute('data-distance')), { timeout: 10_000 }).toBeLessThan(200);
});

test('changes lane from the keyboard or a swipe', async ({ page, isMobile }) => {
  await page.goto('/?seed=5&q=low&intro=0');
  const app = page.locator('#app');
  await expect(app).toHaveAttribute('data-lane', '2');
  if (isMobile) {
    // A 60 px right swipe (GDD §4: ≥ 24 px within 180 ms), dispatched in one task so a slow software-rendered frame
    // can't land between the events and stretch the gesture past 180 ms.
    await page.evaluate(() => {
      const canvas = document.getElementById('game');
      if (!canvas) throw new Error('no canvas');
      const r = canvas.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      const ev = (type: string, dx: number) =>
        new PointerEvent(type, {
          pointerId: 7,
          pointerType: 'touch',
          clientX: x + dx,
          clientY: y,
          isPrimary: true,
          bubbles: true,
        });
      canvas.dispatchEvent(ev('pointerdown', 0));
      canvas.dispatchEvent(ev('pointermove', 60));
      canvas.dispatchEvent(ev('pointerup', 60));
    });
  } else {
    await page.keyboard.press('ArrowRight');
  }
  await expect(app).toHaveAttribute('data-lane', '3');
});

test('the launch intro counts down and hands over to the run', async ({ page }) => {
  await page.goto('/?seed=5&q=low');
  const app = page.locator('#app');
  const count = page.locator('.intro-count');
  await expect(app).toHaveAttribute('data-screen', 'intro');
  await expect(count).toHaveText(/^[321]$/);
  await expect(page.locator('.intro-toast')).toBeVisible();
  await expect(app).toHaveAttribute('data-screen', 'playing', { timeout: 20_000 });
  await expect(count).toHaveText(/\S/); // "Старт!" lingers for a moment, then the overlay goes
  await expect(page.locator('.intro')).toBeHidden({ timeout: 5_000 });
  await expect
    .poll(async () => Number(await app.getAttribute('data-distance')), { timeout: 15_000 })
    .toBeGreaterThan(5);
});

test('a double tap or double Space jumps and flips', async ({ page, isMobile }) => {
  // Keep input timing and the brief rotation observable even when software-rendered frames and tracing are slow.
  // Only the browser clock is controlled: the real device adapters, fixed-step sim and renderer still execute.
  await page.clock.install({ time: 1_000_000 });
  await page.clock.pauseAt(1_001_000);
  await page.goto('/?seed=5&q=low&intro=0');
  await page.clock.runFor(250);
  const app = page.locator('#app');
  await expect(app).toHaveAttribute('data-screen', 'playing');
  await expect(page.locator('.results-retry')).not.toBeFocused();
  if (!isMobile) {
    // Observe actual keyboard delivery and default prevention, without calling the input mapper or sim.
    await page.evaluate(() => {
      const root = document.getElementById('app');
      window.addEventListener('keydown', (event) => {
        if (event.code !== 'Space' || !root) return;
        root.dataset['testSpacePresses'] = String(Number(root.dataset['testSpacePresses'] ?? 0) + 1);
        root.dataset['testSpacePrevented'] = String(event.defaultPrevented);
        root.dataset['testSpaceTrusted'] = String(event.isTrusted);
        root.dataset['testSpaceTarget'] = event.target instanceof HTMLElement ? event.target.tagName : '';
      });
    });
  }
  await expect
    .poll(async () => Number(await app.getAttribute('data-distance')), { timeout: 15_000 })
    .toBeGreaterThan(5);
  const press = async () => {
    if (!isMobile) return page.keyboard.press('Space');
    // A tap: down and up on the same spot within one task, so a slow software frame can't stretch it.
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
  await press();
  await page.clock.runFor(50);
  // A first press must only jump. The second real press, while airborne, must produce the rotation.
  await expect(app).toHaveAttribute('data-air', '1', { timeout: 10_000 });
  await expect(app).toHaveAttribute('data-flip', '0.00');
  await press();
  await page.clock.runFor(100);
  await expect
    .poll(async () => Number(await app.getAttribute('data-flip')), { timeout: 10_000, intervals: [16] })
    .toBeGreaterThan(0);
  // A timely committed flip finishes before this jump's touchdown; it must not become a landing crash.
  await page.clock.runFor(800);
  await expect(app).toHaveAttribute('data-air', '0', { timeout: 10_000 });
  await expect(app).toHaveAttribute('data-flip', '0.00');
  await expect(app).toHaveAttribute('data-screen', 'playing');
  if (!isMobile) {
    await expect(app).toHaveAttribute('data-test-space-presses', '2');
    await expect(app).toHaveAttribute('data-test-space-prevented', 'true');
    await expect(app).toHaveAttribute('data-test-space-trusted', 'true');
    await expect(app).toHaveAttribute('data-test-space-target', 'BODY');
  }
});
