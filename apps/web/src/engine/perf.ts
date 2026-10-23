import type { WebGLRenderer } from 'three';

// Frame-time readout for device checks (D0 item 5 / P1-04): add #perf to the URL. Presentation-only.

export type PerfMeter = { frame(ms: number): void };

export function createPerfMeter(info: WebGLRenderer['info']): PerfMeter {
  if (!location.hash.includes('perf')) return { frame: () => undefined };
  const el = document.createElement('p');
  el.style.cssText =
    'position:fixed;left:8px;top:calc(8px + env(safe-area-inset-top));margin:0;padding:4px 8px;font:12px/1.3 system-ui;' +
    'color:#f3e9d2;background:rgb(26 28 38 / 75%);border-radius:4px;z-index:10;pointer-events:none';
  document.body.append(el);
  const times = new Float64Array(300);
  let n = 0;
  return {
    frame(ms) {
      times[n % times.length] = ms;
      n++;
      if (n % 30 !== 0) return;
      const sorted = Array.from(times.subarray(0, Math.min(n, times.length))).sort((a, b) => a - b);
      const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] ?? 0;
      el.textContent = `p50 ${at(0.5).toFixed(1)} ms · p95 ${at(0.95).toFixed(1)} ms · ${info.render.calls} draws · ${(info.render.triangles / 1000).toFixed(0)}k tris`;
    },
  };
}
