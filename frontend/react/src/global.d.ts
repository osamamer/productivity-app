declare global {
    interface Window {
        global: typeof globalThis;
    }
}
