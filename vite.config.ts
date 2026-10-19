import { defineConfig } from 'vitest/config';
export default defineConfig({
  // Pages supplies its actual repository/custom-domain path; local builds remain portable.
  base: process.env.VITE_BASE_PATH || './',
  build: { target: 'es2022', chunkSizeWarningLimit: 650, rollupOptions: { output: { manualChunks: { 'three-core': ['three'] } } } },
  test: { include: ['tests/**/*.test.ts'] },
});
