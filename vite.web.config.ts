import { defineConfig } from 'vite';

export default defineConfig({
  root: 'apps/web',
  resolve: {
    alias: {
      '@hermes-client/core': new URL('./packages/core/src/index.ts', import.meta.url).pathname,
      '@hermes-client/protocol': new URL('./packages/hermes-client/src/index.ts', import.meta.url)
        .pathname,
    },
  },
  build: { outDir: 'dist', emptyOutDir: true, sourcemap: false },
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
});
