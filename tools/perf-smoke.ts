import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { arch, platform } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { gzipSync } from 'node:zlib';
import { chromium, type Browser } from '@playwright/test';
import { build, preview, type PreviewServer } from 'vite';
import { z } from 'zod';
import { readPerfMeasurement, startPerfDriver } from './perf-browser';
import { checkPerfReport, perfConfigurationSchema, PERF_BUDGETS, readPerfBaseline } from './perf-report';

const { values } = parseArgs({
  options: {
    duration: { type: 'string', default: '90' },
    seed: { type: 'string', default: '5' },
    viewport: { type: 'string', default: 'desktop' },
    quality: { type: 'string', default: 'low' },
    output: { type: 'string' },
    url: { type: 'string' },
    baseline: { type: 'string' },
  },
});
const configuration = perfConfigurationSchema.parse({
  scriptVersion: 1,
  durationS: Number(values.duration),
  seed: Number(values.seed),
  viewport: values.viewport,
  quality: values.quality,
});
const output = resolve(values.output ?? `perf-report/${configuration.viewport}.json`);
const baseline = values.baseline ? readPerfBaseline(values.baseline) : undefined;
const externalUrl = values.url ? z.url().parse(values.url) : undefined;
if (externalUrl) {
  const parsed = new URL(externalUrl);
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password)
    throw new Error('--url must be HTTP(S) without embedded credentials');
}

function bundleBytes(directory: string): { jsGzip: number; files: number } {
  let jsGzip = 0;
  let files = 0;
  for (const entry of readdirSync(directory)) {
    const file = join(directory, entry);
    if (statSync(file).isDirectory()) {
      const child = bundleBytes(file);
      jsGzip += child.jsGzip;
      files += child.files;
    } else if (file.endsWith('.js')) {
      jsGzip += gzipSync(readFileSync(file), { level: 9 }).length;
      files++;
    }
  }
  return { jsGzip, files };
}

async function main(): Promise<void> {
  mkdirSync(dirname(output), { recursive: true });
  let server: PreviewServer | undefined;
  let browser: Browser | undefined;
  let interrupted = false;
  const errors: string[] = [];
  const report: Record<string, unknown> = {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    configuration,
    budgets: PERF_BUDGETS,
    passed: false,
    errors,
    environment: { node: process.version, os: platform(), arch: arch() },
    timing: 'Real wall-clock rAF intervals during active play, informational; not a phone performance claim.',
    scenario: 'Fixed 500 ms keyboard-event script, natural crashes and Retry, incrementing run seeds. No sim bypass.',
    limitations: [
      'Wall-clock inputs may reach different sim ticks on different renderers; this is not a deterministic replay.',
      'Geometry comparisons require matching profiles and representative run coverage; frame milliseconds are never gated.',
      'GPU texture bytes, GC pauses and phone/device performance are not measured by this smoke.',
    ],
  };
  const interrupt = () => {
    interrupted = true;
    void browser?.close().catch((error: unknown) => console.error('Browser cleanup:', error));
  };
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', interrupt);
  try {
    report['commit'] = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    report['dirty'] = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).length > 0;
    let base = externalUrl;
    if (!base) {
      const root = resolve('apps/web');
      const configFile = resolve('apps/web/vite.config.ts');
      await build({ root, configFile });
      // Match the shipped policy; a standalone preview has no authorized embedding host.
      const csp = readFileSync('deploy/Caddyfile', 'utf8')
        .match(/Content-Security-Policy "([^"]+)"/)?.[1]
        ?.replace('{$ISKENDY_HOST_ORIGIN}', "'none'");
      if (!csp || csp.includes('{$')) throw new Error('Cannot resolve the deployment CSP for local preview');
      // Vite preview installs auto-exit handlers. This CLI owns signals so interrupted reports reach finally.
      // Preserve existing listeners and detach only those added by this isolated preview startup.
      const sigtermListeners = new Set(process.rawListeners('SIGTERM'));
      const stdinEndListeners = new Set(process.stdin.rawListeners('end'));
      try {
        server = await preview({
          root,
          configFile,
          preview: {
            host: '127.0.0.1',
            port: 0,
            strictPort: true,
            open: false,
            headers: { 'Content-Security-Policy': csp },
          },
        });
      } finally {
        for (const listener of process.rawListeners('SIGTERM'))
          if (!sigtermListeners.has(listener)) process.removeListener('SIGTERM', listener);
        for (const listener of process.stdin.rawListeners('end'))
          if (!stdinEndListeners.has(listener)) process.stdin.removeListener('end', listener);
      }
      base = server.resolvedUrls?.local[0];
      report['bundle'] = bundleBytes(resolve('apps/web/dist'));
    } else {
      report['bundle'] = null;
      report['bundleOmission'] = 'External URL: a local build would not establish the bytes served by this origin.';
    }
    if (!base) throw new Error('Local preview has no listening URL');
    if (interrupted) throw new Error('Performance smoke interrupted');
    const url = new URL(base);
    url.searchParams.set('seed', String(configuration.seed));
    url.searchParams.set('q', configuration.quality);
    url.searchParams.set('intro', '0');
    url.hash = 'perf';
    report['source'] = externalUrl ? 'external URL' : 'fresh production build / local Vite preview';
    const executablePath = process.env['PW_CHROMIUM_EXECUTABLE'];
    browser = await chromium.launch({
      ...(executablePath ? { executablePath } : {}),
      // The CLI must write a failed report and close its owned preview before exiting on a signal.
      handleSIGINT: false,
      handleSIGTERM: false,
    });
    report['browser'] = browser.version();
    const mobile = configuration.viewport === 'mobile';
    const page = await browser.newPage({
      viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
      deviceScaleFactor: mobile ? 3 : 1,
      isMobile: mobile,
      hasTouch: mobile,
    });
    page.setDefaultTimeout(30_000);
    page.on('pageerror', (error) => {
      if (errors.length < 100) errors.push(`Page: ${error.message}`);
    });
    page.on('crash', () => errors.push('Browser page crashed'));
    page.on('console', (message) => {
      if (message.type() === 'error' && errors.length < 100) errors.push(`Console: ${message.text()}`);
    });
    await page.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', (event) => {
        console.error(`CSP ${event.disposition}: ${event.effectiveDirective}`);
      });
      // three.js retains its last positive counters after context loss; those are not fresh render samples.
      document.addEventListener('webglcontextlost', () => console.error('WebGL context lost'), { capture: true });
    });
    const response = await page.goto(url.href, { waitUntil: 'load', timeout: 60_000 });
    report['contentSecurityPolicy'] = response?.headers()['content-security-policy'] ?? null;
    await page.waitForSelector('#kometa-perf', { state: 'attached' });
    await startPerfDriver(page);
    const started = performance.now();
    console.log(
      `Measuring ${configuration.durationS}s wall time, ${configuration.viewport}/${configuration.quality}, seed ${configuration.seed}`,
    );
    while (performance.now() - started < configuration.durationS * 1000) {
      if (interrupted) throw new Error('Performance smoke interrupted');
      if (errors.length > 0) throw new Error('Browser reported errors during performance measurement');
      await new Promise((done) =>
        setTimeout(done, Math.min(250, configuration.durationS * 1000 - (performance.now() - started))),
      );
    }
    report['elapsedWallMs'] = performance.now() - started;
    const result = await readPerfMeasurement(page);
    report['measurement'] = result.measurement;
    report['driver'] = result.driver;
    report['userAgent'] = result.userAgent;
    report['gpuRenderer'] = result.gpuRenderer;
    const cdp = await page.context().newCDPSession(page);
    const heap = await cdp.send('Runtime.getHeapUsage');
    report['heap'] = {
      usedBytes: heap.usedSize,
      totalBytes: heap.totalSize,
      scope: 'V8 heap; not total tab or GPU memory',
    };
    await cdp.detach();
    errors.push(...checkPerfReport(result.measurement, configuration, baseline));
    report['baseline'] = values.baseline ?? null;
    const screenshot = output.replace(/\.json$/i, '') + '.png';
    await page.screenshot({ path: screenshot });
    report['screenshot'] = { path: screenshot, screenAtRead: result.screen };
    report['passed'] = errors.length === 0;
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  } finally {
    if (interrupted && !errors.includes('Performance smoke interrupted')) errors.push('Performance smoke interrupted');
    try {
      if (browser) await browser.close();
    } catch (error) {
      errors.push(`Browser cleanup: ${String(error)}`);
    }
    try {
      // Public close also clears Vite's signal callback registry and plugin resources.
      if (server) await server.close();
    } catch (error) {
      errors.push(`Server cleanup: ${String(error)}`);
    }
    process.removeListener('SIGINT', interrupt);
    process.removeListener('SIGTERM', interrupt);
    report['passed'] = errors.length === 0;
    writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  }
  console.log(`Performance report: ${output}`);
  if (errors.length > 0) throw new Error(errors.join('\n'));
}

await main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
