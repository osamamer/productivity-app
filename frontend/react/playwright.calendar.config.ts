import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './browser-tests',
    reporter: 'list',
    use: { baseURL: 'http://127.0.0.1:5191', trace: 'retain-on-failure' },
    webServer: {
        command: 'npm run dev -- --host 127.0.0.1 --port 5191 --strictPort',
        url: 'http://127.0.0.1:5191',
        reuseExistingServer: false,
    },
});
