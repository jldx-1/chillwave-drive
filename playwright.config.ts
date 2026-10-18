import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 1280, height: 800 },
    launchOptions: { args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-dev-shm-usage'] },
    screenshot: 'only-on-failure',
  },
  webServer: [{
    command: 'npm run preview -- --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
  }, {
    command: 'node tests/browser/serve-subdirectory.mjs',
    url: 'http://127.0.0.1:4174/chillwave-drive/',
    reuseExistingServer: !process.env.CI,
  }],
});
