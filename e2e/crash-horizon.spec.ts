import { expect, test, type Page } from '@playwright/test';
import { reachCrash } from './helpers/reach-crash';

// Harness-only DOM regressions: no game, renderer, storage, network fixture or simulated state injection.
const fixture = async (page: Page) => {
  await page.clock.install({ time: 1_000_000 });
  await page.clock.pauseAt(1_001_000);
  await page.setContent('<main id="app" data-screen="playing"></main>');
  return page.evaluateHandle(() => {
    let active = 0;
    const NativeObserver = window.MutationObserver;
    window.MutationObserver = class extends NativeObserver {
      private observing = false;
      override observe(target: Node, options: MutationObserverInit) {
        super.observe(target, options);
        if (!this.observing) active++;
        this.observing = true;
      }
      override disconnect() {
        super.disconnect();
        if (this.observing) active--;
        this.observing = false;
      }
    };
    return { active: () => active, restore: () => (window.MutationObserver = NativeObserver) };
  });
};
const schedule = async (page: Page, crashFrame: number, twice = false) => {
  await page.evaluate(
    ({ crashFrame, twice }) => {
      const app = document.getElementById('app');
      if (!app) throw new Error('synthetic app missing');
      app.dataset['screen'] = 'playing';
      let frame = 0;
      const tick = () => {
        if (++frame === crashFrame) {
          app.dataset['screen'] = 'crashing';
          if (twice) {
            app.dataset['screen'] = 'playing';
            app.dataset['screen'] = 'crashing';
          }
        }
        if (frame < 3) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    },
    { crashFrame, twice },
  );
};

for (const scenario of [
  { name: 'first impact on the final frame', crashFrame: 3, passes: true, twice: false },
  { name: 'one unwanted frame after impact', crashFrame: 2, passes: false, twice: false },
  { name: 'missing impact', crashFrame: 0, passes: false, twice: false },
  { name: 'two transitions on one frame', crashFrame: 3, passes: false, twice: true },
]) {
  test(`crash horizon detects ${scenario.name}`, async ({ page }) => {
    const observers = await fixture(page);
    try {
      await schedule(page, scenario.crashFrame, scenario.twice);
      // 14 ticks requires exactly three five-tick catch-up frames, including after a 0–2 tick startup.
      if (scenario.passes) await reachCrash(page, 14);
      else await expect(reachCrash(page, 14)).rejects.toThrow();
      expect(await observers.evaluate((probe) => probe.active())).toBe(0);
    } finally {
      await observers.evaluate((probe) => probe.restore());
      await observers.dispose();
    }
  });
}

test('crash horizon rejects arming after impact and rearms independently after Retry', async ({ page }) => {
  const observers = await fixture(page);
  try {
    await page.evaluate(() => {
      const app = document.getElementById('app');
      if (!app) throw new Error('synthetic app missing');
      app.dataset['screen'] = 'crashing';
    });
    await expect(reachCrash(page, 14)).rejects.toThrow('must arm while playing');
    expect(await observers.evaluate((probe) => probe.active())).toBe(0);
    for (let run = 0; run < 2; run++) {
      await schedule(page, 3);
      await reachCrash(page, 14);
      expect(await observers.evaluate((probe) => probe.active())).toBe(0);
    }
  } finally {
    await observers.evaluate((probe) => probe.restore());
    await observers.dispose();
  }
});

test('crash horizon disconnects its observer when the clock rejects', async ({ page }) => {
  const observers = await fixture(page);
  const fastForward = page.clock.fastForward.bind(page.clock);
  try {
    await schedule(page, 3);
    page.clock.fastForward = async (ticks) => {
      await fastForward(ticks);
      throw new Error('injected clock rejection');
    };
    await expect(reachCrash(page, 14)).rejects.toThrow('injected clock rejection');
    expect(await observers.evaluate((probe) => probe.active())).toBe(0);
  } finally {
    page.clock.fastForward = fastForward;
    await observers.evaluate((probe) => probe.restore());
    await observers.dispose();
  }
});
