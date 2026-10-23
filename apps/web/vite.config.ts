import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  // No source maps in the shipped build: v1 has no error-reporting service to upload them to (DECISIONS Q18).
  build: { target: 'es2022', sourcemap: false },
});
