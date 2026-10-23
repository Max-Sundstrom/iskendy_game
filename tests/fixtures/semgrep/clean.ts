// Fixture: none of the project rules may fire here.
declare const el: HTMLElement;
declare const input: string;
const HOST_ORIGIN = 'https://host.example';

el.textContent = input;
window.parent.postMessage({ type: 'game.ready' }, HOST_ORIGIN);
window.addEventListener('message', (event) => {
  if (event.origin !== HOST_ORIGIN) return;
  console.info(event.data);
});
