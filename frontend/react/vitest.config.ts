import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(viteConfig, defineConfig({
    define: {
        // Production code reads `global`; Vite's `{}` replacement breaks Node globals under jsdom.
        global: 'globalThis',
    },
    test: {
        environment: 'jsdom',
        include: ['src/**/*.test.{ts,tsx}'],
        setupFiles: ['src/test/setup.ts'],
        env: { TZ: 'UTC', VITE_API_URL: 'http://api.test' },
        restoreMocks: true,
    },
}));
