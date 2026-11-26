import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { server } from './server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
    cleanup();
    server.resetHandlers();
    window.localStorage.clear();
    window.sessionStorage.clear();
});
afterAll(() => server.close());

// jsdom has no layout engine; components that observe size only need these to exist.
class NoopObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return []; }
}
globalThis.ResizeObserver ??= NoopObserver as unknown as typeof ResizeObserver;
globalThis.IntersectionObserver ??= NoopObserver as unknown as typeof IntersectionObserver;
window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
})) as typeof window.matchMedia;
window.scrollTo = () => {};
Element.prototype.scrollIntoView ??= function scrollIntoView() {};

// The STOMP socket is a network boundary that MSW cannot serve; tests run without live pushes.
vi.mock('../services/authenticatedStompClient', () => ({
    createAuthenticatedStompClient: () => ({
        active: false,
        connected: false,
        activate() {},
        deactivate: () => Promise.resolve(),
        subscribe: () => ({ unsubscribe() {} }),
        unsubscribe() {},
        publish() {},
    }),
}));

// jsdom has no 2D canvas, so celebration confetti would throw on its first frame.
vi.mock('canvas-confetti', () => {
    const fire = Object.assign(() => Promise.resolve(), { reset() {} });
    return { default: Object.assign(fire, { create: () => fire }) };
});
