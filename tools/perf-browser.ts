import type { Page } from '@playwright/test';
import { z } from 'zod';
import { perfSnapshotSchema } from './perf-report';

const driverSchema = z.object({
  retries: z.number().int().nonnegative(),
  runs: z.number().int().positive(),
  maxDistanceM: z.number().finite().nonnegative(),
  inputs: z
    .array(
      z.object({
        elapsedMs: z.number().finite().nonnegative(),
        code: z.string().max(32),
        run: z.number().int().nonnegative(),
      }),
    )
    .max(2000),
});

/** Starts a fixed wall-clock input script through the production keyboard and Retry handlers. */
export async function startPerfDriver(page: Page): Promise<void> {
  await page.evaluate(() => {
    const root = document.getElementById('app');
    if (!root || !document.getElementById('kometa-perf')) throw new Error('Performance diagnostics did not load');
    document.dispatchEvent(new Event('kometa:perf-reset'));
    const keys = ['ArrowRight', 'Space', 'ArrowLeft', 'Space', 'Space', 'ArrowLeft', 'ArrowRight', 'Space'];
    let index = 0;
    let retries = 0;
    let maxDistanceM = 0;
    let boostHeld = false;
    const start = performance.now();
    const inputs: { elapsedMs: number; code: string; run: number }[] = [];
    const timer = setInterval(() => {
      maxDistanceM = Math.max(maxDistanceM, Number(root.dataset['distance']) || 0);
      if (boostHeld) window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ShiftLeft', bubbles: true }));
      boostHeld = false;
      if (root.dataset['screen'] === 'results') {
        const retry = document.querySelector<HTMLButtonElement>('.results-retry');
        if (!retry) throw new Error('No Retry button after crash');
        retry.click();
        retries++;
        inputs.push({ elapsedMs: performance.now() - start, code: 'Retry', run: retries });
        return;
      }
      if (root.dataset['screen'] !== 'playing') return;
      const code = keys[index % keys.length] ?? 'Space';
      window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true }));
      window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true, cancelable: true }));
      if (index % keys.length === keys.length - 1) {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ShiftLeft', bubbles: true, cancelable: true }));
        boostHeld = true;
      }
      inputs.push({ elapsedMs: performance.now() - start, code, run: retries });
      index++;
    }, 500);
    document.addEventListener(
      'kometa:perf-stop-driver',
      () => {
        clearInterval(timer);
        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ShiftLeft', bubbles: true }));
        root.dataset['perfDriver'] = JSON.stringify({ retries, runs: retries + 1, maxDistanceM, inputs });
      },
      { once: true },
    );
  });
}

/** Stops only the scripted controls and extracts the game's diagnostic counters. */
export async function readPerfMeasurement(page: Page) {
  const raw = await page.evaluate(() => {
    document.dispatchEvent(new Event('kometa:perf-stop-driver'));
    document.dispatchEvent(new Event('kometa:perf-read'));
    const canvas = document.querySelector<HTMLCanvasElement>('#game');
    const gl = canvas?.getContext('webgl2');
    const debug = gl?.getExtension('WEBGL_debug_renderer_info');
    return {
      report: document.getElementById('kometa-perf')?.dataset['report'],
      driver: document.getElementById('app')?.dataset['perfDriver'],
      screen: document.getElementById('app')?.dataset['screen'],
      userAgent: navigator.userAgent,
      gpuRenderer: gl && debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : null,
    };
  });
  if (!raw.report || raw.report.length > 1024 * 1024) throw new Error('Missing or oversized performance snapshot');
  if (!raw.driver || raw.driver.length > 1024 * 1024) throw new Error('Missing or oversized input coverage');
  return {
    ...raw,
    driver: driverSchema.parse(JSON.parse(raw.driver) as unknown),
    measurement: perfSnapshotSchema.parse(JSON.parse(raw.report) as unknown),
  };
}
