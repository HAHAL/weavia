import { defineConfig, devices } from '@playwright/test';
export default defineConfig({ testDir:'./tests/e2e', timeout:30000, use:{ baseURL:'http://127.0.0.1:1420', ...devices['Desktop Chrome'] }, webServer:{ command:'pnpm dev',url:'http://127.0.0.1:1420',reuseExistingServer:!process.env.CI,timeout:30000 }, reporter:'list' });
