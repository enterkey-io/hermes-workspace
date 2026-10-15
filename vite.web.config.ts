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
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: {
        workspace: new URL('./apps/web/index.html', import.meta.url).pathname,
        avatarLab: new URL('./apps/web/avatar-lab.html', import.meta.url).pathname,
      },
    },
  },
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
});
