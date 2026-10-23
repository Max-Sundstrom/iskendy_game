import type { Strings } from '../platform/i18n';
import { el } from './dom';

// Results (GDD §15.4, ADR-020): end line, score, NEW BEST, distance and time, the promo code, Retry. No Ranking in v1.

export type RunResult = { score: number; distanceM: number; timeS: number; newBest: boolean; promoCode: string };

export type Results = { show(r: RunResult): void; hide(): void; readonly retry: HTMLButtonElement };

const fmt = (n: number) => String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function createResults(parent: HTMLElement, t: Strings): Results {
  const root = el('section', 'results');
  root.hidden = true;
  root.setAttribute('aria-live', 'polite');
  const card = el('div', 'results-card');
  const cause = el('p', 'results-cause', t.results.crash);
  const score = el('p', 'results-score');
  const badge = el('span', 'results-badge', t.results.newBest);
  const stats = el('div', 'results-stats');
  const distance = el('b');
  const time = el('b');
  const d = el('div');
  d.append(distance, el('span', undefined, t.results.distance));
  const tm = el('div');
  tm.append(time, el('span', undefined, t.results.time));
  stats.append(d, tm);
  const promo = el('div', 'results-promo');
  const code = el('code', 'results-code');
  promo.append(el('small', undefined, t.results.promo), code);
  const retry = el('button', 'results-retry', t.results.retry);
  retry.type = 'button';
  card.append(cause, score, badge, stats, promo, retry);
  root.append(card);
  parent.append(root);

  return {
    retry,
    show(r) {
      score.textContent = fmt(r.score);
      badge.hidden = !r.newBest;
      distance.textContent = `${fmt(r.distanceM)} ${t.hud.metres}`;
      time.textContent = clock(r.timeS);
      code.textContent = r.promoCode;
      root.hidden = false;
      retry.focus();
    },
    hide() {
      root.hidden = true;
    },
  };
}
