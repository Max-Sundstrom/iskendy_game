import type { WebGLRenderer } from 'three';
import { createPerfStats } from './perf-stats';

// Frame-time readout for device checks (D0 item 5 / P1-04): add #perf to the URL. Presentation-only.

export type PerfMeter = { frame(ms: number, active: boolean): void };

export function createPerfMeter(info: WebGLRenderer['info']): PerfMeter {
  if (!location.hash.includes('perf')) return { frame: () => undefined };
  const el = document.createElement('p');
  el.id = 'kometa-perf';
  el.className = 'perf-meter';
  document.body.append(el);
  const stats = createPerfStats();
  let n = 0;
  // Read-only diagnostics protocol for tools/perf-smoke.ts. Neither event changes game state or controls.
  document.addEventListener('kometa:perf-read', () => {
    el.dataset['report'] = JSON.stringify(stats.snapshot());
    el.textContent = stats.label();
  });
  document.addEventListener('kometa:perf-reset', () => {
    stats.reset();
    n = 0;
    delete el.dataset['report'];
  });
  return {
    frame(ms, active) {
      stats.frame(ms, active, info);
      n++;
      if (n === 1 || n % 30 === 0) el.textContent = stats.label();
    },
  };
}
