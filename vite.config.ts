import { defineConfig } from 'vitest/config';
export default defineConfig({
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 650, rollupOptions: { output: { manualChunks: { 'three-core': ['three'] } } } },
  test: { include: ['tests/**/*.test.ts'] },
});
