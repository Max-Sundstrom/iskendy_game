import { expect, test } from '@playwright/test';
import busy from '../tests/replays/busy-inputs.json' with { type: 'json' };
import early from '../tests/replays/early-crash.json' with { type: 'json' };
import long from '../tests/replays/long-run.json' with { type: 'json' };

// P1-06 acceptance: the golden replays reproduce in every engine the project runs (Chromium here; WebKit and Firefox
// in the CI cross-engine job), matching the hashes Node recorded. Dev server only: the probe isn't in the build.
test.skip(Boolean(process.env['BASE_URL']), 'probe page exists only on the dev server');

test('golden replays reproduce in this browser engine', async ({ page }) => {
  await page.goto('/test/replays.html');
  const raw = await page.locator('body').getAttribute('data-results', { timeout: 30_000 });
  expect(JSON.parse(raw ?? '[]')).toEqual([
    { name: 'busy-inputs', hash: busy.finalHash, valid: true },
    { name: 'early-crash', hash: early.finalHash, valid: true },
    { name: 'long-run', hash: long.finalHash, valid: true },
  ]);
});
