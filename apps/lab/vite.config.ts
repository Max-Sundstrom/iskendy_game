import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Design lab for Phase D0 (art board, car blockouts, style-test chunk, HUD frames). Never shipped with the game.
export default defineConfig({
  base: './',
  server: { port: 5174, strictPort: true },
  preview: { port: 4174, strictPort: true },
  build: {
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      input: Object.fromEntries(
        ['index', 'board', 'car', 'style', 'hud'].map((page) => [page, resolve(import.meta.dirname, `${page}.html`)]),
      ),
    },
  },
});
