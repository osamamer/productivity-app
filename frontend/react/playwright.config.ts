import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './smoke',
    reporter: 'list',
    use: {
        baseURL: 'http://127.0.0.1:4173',
        trace: 'retain-on-failure',
    },
    webServer: {
        command: 'npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
        url: 'http://127.0.0.1:4173/sign-in',
        reuseExistingServer: false,
        timeout: 30_000,
    },
});
