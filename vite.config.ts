import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { port: 5173 },
  // Phaser alone is ~1.2 MB minified; that's expected.
  build: { chunkSizeWarningLimit: 1500 },
});
