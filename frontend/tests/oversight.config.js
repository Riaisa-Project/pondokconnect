import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: '.',
  testMatch: 'oversight.spec.js',
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:5175',
    viewport: { width: 1365, height: 900 },
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
      args: [
        '--no-sandbox',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
      ],
    },
  },
  webServer: {
    command: 'npm run dev -- --port 5175',
    cwd: new URL('..', import.meta.url).pathname,
    url: 'http://127.0.0.1:5175',
    reuseExistingServer: false,
  },
})
