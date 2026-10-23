import type * as NodeUtil from 'node:util';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  browserClose: vi.fn<() => Promise<void>>(),
  serverClose: vi.fn<() => Promise<void>>(),
  writeReport: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn((_file: string, args: string[]) => (args[0] === 'rev-parse' ? 'test-commit' : '')),
}));
vi.mock('node:fs', () => ({
  mkdirSync: vi.fn(),
  readdirSync: vi.fn(() => []),
  readFileSync: vi.fn(() => 'Content-Security-Policy "default-src \'none\'"'),
  statSync: vi.fn(),
  writeFileSync: harness.writeReport,
}));
vi.mock('node:util', async (original) => ({
  ...(await original<typeof NodeUtil>()),
  parseArgs: () => ({
    values: { duration: '1', seed: '5', viewport: 'desktop', quality: 'low', output: '/unused/perf.json' },
  }),
}));
vi.mock('vite', () => ({
  build: vi.fn(async () => undefined),
  preview: vi.fn(async () => ({ resolvedUrls: { local: ['http://localhost:12345'] }, close: harness.serverClose })),
}));
vi.mock('@playwright/test', () => ({
  chromium: {
    launch: vi.fn(async () => ({
      version: () => 'test-browser',
      close: harness.browserClose,
      newPage: async () => ({
        setDefaultTimeout: vi.fn(),
        on: vi.fn(),
        addInitScript: vi.fn(async () => undefined),
        goto: vi.fn(async () => ({ headers: () => ({}) })),
        waitForSelector: vi.fn(async () => undefined),
        screenshot: vi.fn(async () => undefined),
        context: () => ({
          newCDPSession: async () => ({
            send: async () => ({ usedSize: 1, totalSize: 2 }),
            detach: async () => undefined,
          }),
        }),
      }),
    })),
  },
}));
vi.mock('./perf-browser', () => ({
  startPerfDriver: vi.fn(async () => undefined),
  readPerfMeasurement: vi.fn(async () => ({
    measurement: {
      schemaVersion: 1,
      frames: 60,
      activeFrames: 60,
      invalidFrames: 0,
      storedSamples: 60,
      overflowFrames: 0,
      activeFrameMs: 1000,
      totalFrameMs: 1000,
      frameTimeMs: { p50: 16, p95: 17, max: 18 },
      maxDrawCalls: 10,
      maxTriangles: 100,
      maxGeometries: 1,
      maxTextures: 1,
    },
    driver: { retries: 0, runs: 1, maxDistanceM: 1, inputs: [] },
    screen: 'playing',
    userAgent: 'test-browser',
    gpuRenderer: 'test-renderer',
  })),
}));

function deferred() {
  let resolve: () => void = () => {
    throw new Error('Deferred resolver was not initialized');
  };
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('performance CLI interruption while cleanup awaits', () => {
  const signals = new Map<string, () => void>();
  let previousExitCode: typeof process.exitCode;
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    signals.clear();
    previousExitCode = process.exitCode;
    process.exitCode = undefined;
    harness.browserClose.mockResolvedValue(undefined);
    harness.serverClose.mockResolvedValue(undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const once = process.once;
    // Capture the real CLI handlers without delivering OS signals to the shared Vitest worker.
    vi.spyOn(process, 'once').mockImplementation(function (event, listener) {
      if (event === 'SIGTERM' || event === 'SIGINT') {
        signals.set(event, listener);
        return process;
      }
      return once.call(process, event, listener);
    });
  });
  afterEach(() => {
    process.exitCode = previousExitCode;
    vi.restoreAllMocks();
  });

  it.each([
    ['SIGTERM', 'browser'],
    ['SIGINT', 'browser'],
    ['SIGTERM', 'server'],
    ['SIGINT', 'server'],
  ] as const)('%s during %s.close cannot publish a successful report', async (signal, resource) => {
    const entered = deferred();
    const release = deferred();
    const close = resource === 'browser' ? harness.browserClose : harness.serverClose;
    close.mockImplementation(() => {
      entered.resolve();
      return release.promise;
    });
    const completed = import('./perf-smoke');
    await entered.promise;
    try {
      expect(harness.writeReport).not.toHaveBeenCalled();
      const interrupt = signals.get(signal);
      expect(interrupt).toBeTypeOf('function');
      interrupt?.();
      expect(harness.writeReport).not.toHaveBeenCalled();
    } finally {
      release.resolve();
      await completed;
    }
    expect(harness.browserClose).toHaveBeenCalled();
    expect(harness.serverClose).toHaveBeenCalledTimes(1);
    expect(harness.writeReport).toHaveBeenCalledTimes(1);
    const report: unknown = JSON.parse(String(harness.writeReport.mock.calls[0]?.[1]));
    expect(report).toMatchObject({ passed: false, errors: ['Performance smoke interrupted'] });
    expect(process.exitCode).toBe(1);
  });

  it('still reports success when both cleanup operations finish without a signal', async () => {
    await import('./perf-smoke');
    const report: unknown = JSON.parse(String(harness.writeReport.mock.calls[0]?.[1]));
    expect(report).toMatchObject({ passed: true, errors: [] });
    expect(harness.browserClose).toHaveBeenCalledTimes(1);
    expect(harness.serverClose).toHaveBeenCalledTimes(1);
    expect(process.exitCode).toBeUndefined();
  });
});
