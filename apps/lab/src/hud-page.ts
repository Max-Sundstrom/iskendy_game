import { renderStill } from './still';

// D0-4 style frames: hud.html?w=390&h=844 (portrait phone) or ?w=1440&h=900; &screen=results for the end screen.
const params = new URLSearchParams(location.search);
const width = Number(params.get('w') ?? 390);
const height = Number(params.get('h') ?? 844);
const screen = params.get('screen') === 'results' ? 'results' : 'hud';
const desktop = width > height;

const canvas = document.querySelector<HTMLCanvasElement>('#bg');
const overlay = document.querySelector<HTMLElement>('#overlay');

const drums = (value: string) =>
  [...value].map((ch) => `<span class="drum${ch === ' ' ? ' sep' : ''}">${ch === ' ' ? '' : ch}</span>`).join('');

const HUD = `
  <div class="top">
    <div class="icons"><div class="icon-btn" aria-label="Пауза">❚❚</div><div class="icon-btn" aria-label="Звук">♪</div></div>
    <div class="odometer" style="font-size:${desktop ? 30 : 22}px" aria-label="Счёт 112 126">${drums('112 126')}</div>
    <div class="meter"><div class="bar"><i></i></div><span>LIFTOFF 4,9 с</span></div>
    <div class="row"><span>6 692 м</span><span class="streak"><b>×11</b> серия 1,8 с</span></div>
    <div class="pot">+16 140</div>
    <div class="feed"><span>Сальто вперёд +1 200</span><br /><span>Обгон фуры +3 000</span></div>
  </div>
  <div class="chip"><i></i>Заказ №247 · готовится</div>
  <div class="thumb"><div class="round item">РАДАР</div><div class="round">BOOST</div></div>
  <div class="toast">Достижение: Хет-трик</div>
  <div class="air"><span>AIR</span><div class="segments">${'<i></i>'.repeat(9)}${'<i class="empty"></i>'.repeat(3)}</div><span>597 л</span></div>
  ${desktop ? '<div class="keys"><span><kbd>← →</kbd>полоса</span><span><kbd>Пробел</kbd>прыжок · держать — полёт</span><span><kbd>↓</kbd>удар</span><span><kbd>Shift</kbd>BOOST</span><span><kbd>E</kbd>предмет</span></div>' : ''}
`;

// Promo code format from DECISIONS Q16 (Crockford Base32); the value is a sample.
const RESULTS = `
  <div class="chip chip-top"><i></i>Заказ №247 · готовится</div>
  <div class="results"><div class="card">
    <p class="cause">Пироги подождут.</p>
    <p class="score">112 126</p>
    <span class="badge">НОВЫЙ РЕКОРД</span>
    <div class="stats"><div><b>6 692 м</b>дистанция</div><div><b>1:49</b>время</div><div><b>×23</b>серия</div></div>
    <div class="promo"><small>Ваш промокод</small><code>ISK-7KQ2-M9XD</code></div>
    <div class="actions"><div class="btn primary">Ещё раз</div><div class="btn ghost">Меню</div></div>
  </div></div>
`;

if (canvas && overlay) {
  renderStill(canvas, { concept: 'B', livery: 'courier', view: 'chase', biome: 'embankment', width, height });
  if (desktop) overlay.classList.add('desktop');
  // nosemgrep — static lab markup written here, never shipped (the game builds its UI with React).
  overlay.innerHTML = screen === 'results' ? RESULTS : HUD;
  document.fonts.ready.then(() => {
    document.body.dataset['ready'] = 'true';
  });
}
