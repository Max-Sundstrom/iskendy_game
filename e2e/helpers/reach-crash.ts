import { expect, type Page } from '@playwright/test';
import { MAX_STEPS_PER_FRAME } from '../../apps/web/src/game/loop';

/** Drive an idle fixture to its independently verified terminal tick, preserving the first impact frame. */
export async function reachCrash(page: Page, expectedTicks: number): Promise<void> {
  // start/Retry advances 32 ms (at most two ticks). These fixtures need the same catch-up frame count either way.
  // Fail loudly if a changed loop cap or fixture invalidates that bound instead of skipping impact frames.
  expect(MAX_STEPS_PER_FRAME).toBe(5);
  expect(Number.isSafeInteger(expectedTicks) && expectedTicks > 2).toBe(true);
  const frames = Math.ceil(expectedTicks / MAX_STEPS_PER_FRAME);
  expect(Math.ceil((expectedTicks - 2) / MAX_STEPS_PER_FRAME)).toBe(frames);
  const guard = await page.evaluateHandle(() => {
    const app = document.getElementById('app');
    if (!app || app.dataset['screen'] !== 'playing') throw new Error('crash observer must arm while playing');
    let count = 0;
    let seenAt: number | null = null;
    const record = (records: MutationRecord[]) => {
      for (const [i, mutation] of records.entries()) {
        // oldValue on the next record preserves intermediate transitions within the same microtask checkpoint.
        const following = records[i + 1];
        const next = following ? following.oldValue : app.dataset['screen'];
        if (mutation.oldValue !== 'crashing' && next === 'crashing') {
          count++;
          seenAt ??= Date.now();
        }
      }
    };
    const observer = new MutationObserver(record);
    observer.observe(app, { attributes: true, attributeFilter: ['data-screen'], attributeOldValue: true });
    return {
      finish: () => {
        record(observer.takeRecords());
        observer.disconnect();
        return { screen: app.dataset['screen'], count, seenAt, now: Date.now() };
      },
      disconnect: () => observer.disconnect(),
    };
  });
  let finished = false;
  try {
    // One public clock call per real frame; no per-frame DOM/protocol read or private clock API.
    for (let frame = 0; frame < frames; frame++) await page.clock.fastForward(100);
    const observed = await guard.evaluate((observer) => observer.finish());
    finished = true;
    expect(observed.screen).toBe('crashing');
    expect(observed.count).toBe(1);
    // An early crash followed by even one extra frame must fail, regardless of Node callback delivery timing.
    expect(observed.seenAt).toBe(observed.now);
  } finally {
    try {
      if (!finished && !page.isClosed()) await guard.evaluate((observer) => observer.disconnect());
    } finally {
      await guard.dispose();
    }
  }
}
