// Kill switch page (EMBEDDING §2): tells the host at once that the game is off, so it shows its fallback.
(function () {
  var meta = document.querySelector('meta[name="kometa-host-origin"]');
  var origin = meta && meta.getAttribute('content');
  if (origin && window.parent !== window) {
    window.parent.postMessage({ type: 'game.error', code: 'disabled' }, origin);
  }
})();
