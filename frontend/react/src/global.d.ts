import type { DesktopBridge } from './services/desktop';

declare global {
    interface Window {
        global: typeof globalThis;
        claritardDesktop?: DesktopBridge;
    }
}
