import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // works from any static host / sub-path
  build: { chunkSizeWarningLimit: 800 },
});
