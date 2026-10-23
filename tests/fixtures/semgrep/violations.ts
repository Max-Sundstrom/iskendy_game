// Fixture: every block below must be reported by tools/semgrep/kometa.yml (checked in CI).
declare const el: HTMLElement;
declare const input: string;

el.innerHTML = input; // kometa-no-html-injection
eval(input); // kometa-no-dynamic-code
export const f = new Function(input); // kometa-no-dynamic-code
window.parent.postMessage({ type: 'game.ready' }, '*'); // kometa-postmessage-wildcard-origin
window.addEventListener('message', (event) => {
  // kometa-message-listener-checks-origin
  console.info(event.data);
});
