import { SIM_VERSION } from '@kometa/sim';

// P0 placeholder: proves the web app builds against the workspace packages. Replaced in P1-04/P1-05.
const root = document.querySelector<HTMLElement>('#app');
if (root) {
  root.dataset['simVersion'] = String(SIM_VERSION);
  root.textContent = 'KOMETA';
}
