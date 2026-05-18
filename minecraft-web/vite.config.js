import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  base: '/games/minecraft-web/',
  build: {
    outDir: 'dist',
    target: 'esnext',
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
