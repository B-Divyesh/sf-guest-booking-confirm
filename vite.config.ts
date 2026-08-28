import { defineConfig } from 'vite';

export default defineConfig({
  root: 'frontend',
  publicDir: '../public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      input: {
        main: new URL('./frontend/index.html', import.meta.url).pathname,
        '404': new URL('./frontend/404.html', import.meta.url).pathname
      }
    }
  },
  server: {
    proxy: { '/api': 'http://localhost:8080', '/health': 'http://localhost:8080' }
  },
  test: { include: ['**/*.test.ts'] }
});
