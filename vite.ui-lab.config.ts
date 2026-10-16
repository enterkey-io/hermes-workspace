import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

export default defineConfig({
  root: 'apps/web',
  plugins: [tailwindcss()],
  resolve: {
    alias: {
      '@': resolve('apps/web/src'),
      '@hermes-client/core': resolve('packages/core/src/index.ts'),
      '@hermes-client/protocol': resolve('packages/hermes-client/src/index.ts'),
    },
  },
  build: {
    outDir: resolve('artifacts/ui-reset/build'),
    emptyOutDir: true,
    rollupOptions: { input: resolve('apps/web/ui-lab.html') },
  },
  server: { host: '127.0.0.1', port: 8094, strictPort: true },
});
