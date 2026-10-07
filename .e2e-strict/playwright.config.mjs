import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('.', import.meta.url));
const runDir = process.env.E2E_STRICT_RUN_DIR || resolve(root, 'runs', 'manual');

export default defineConfig({
  testDir: resolve(root, 'tests'),
  fullyParallel: false, workers: 1, retries: 0, maxFailures: 0,
  forbidOnly: true, updateSnapshots: 'none',
  timeout: 30_000, expect: { timeout: 5_000 },
  outputDir: resolve(runDir, 'artifacts'),
  reporter: [
    [resolve(root, 'strict-reporter.mjs'), { outputFile: resolve(runDir, 'summary.json') }],
    ['html', { outputFolder: resolve(runDir, 'html'), open: 'never' }],
  ],
  webServer: { cwd: resolve(root, '..'), command: 'yarn vite --host 127.0.0.1 --port 4173 --strictPort', url: 'http://127.0.0.1:4173/web/', reuseExistingServer: true },
  use: {
    baseURL: 'http://127.0.0.1:4173/web/',
    headless: true,
    viewport: { width: 1280, height: 800 },
    actionTimeout: 5_000, navigationTimeout: 15_000,
    screenshot: 'only-on-failure', trace: 'retain-on-failure',
  },
});
