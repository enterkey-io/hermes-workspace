import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'packages/hermes-client/src/index.ts',
      formats: ['es'],
      fileName: 'hermes-client',
    },
    outDir: 'packages/hermes-client/dist',
    sourcemap: false,
    emptyOutDir: true,
  },
});
