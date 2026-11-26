// One heartbeat for refetching data app-wide: every minute while the window is visible and
// online, and right away when the user comes back (focus, tab shown, network back). Views
// refetch on it and merge the result in place, so an unchanged answer changes nothing.

const INTERVAL_MS = 60_000;
// Focus and visibility often fire together; one refresh is enough.
const MIN_GAP_MS = 15_000;

type Listener = () => void;

const listeners = new Set<Listener>();
let lastTick = Date.now();
let timer: number | undefined;

function canRefresh(): boolean {
    return document.visibilityState === 'visible' && navigator.onLine;
}

function tick(): void {
    if (!canRefresh()) return;
    lastTick = Date.now();
    listeners.forEach(listener => listener());
}

function tickOnReturn(): void {
    if (Date.now() - lastTick >= MIN_GAP_MS) tick();
}

function onVisibilityChange(): void {
    if (document.visibilityState === 'visible') tickOnReturn();
}

function start(): void {
    lastTick = Date.now();
    timer = window.setInterval(tick, INTERVAL_MS);
    window.addEventListener('focus', tickOnReturn);
    window.addEventListener('online', tickOnReturn);
    window.addEventListener('pageshow', tickOnReturn);
    document.addEventListener('visibilitychange', onVisibilityChange);
}

function stop(): void {
    window.clearInterval(timer);
    timer = undefined;
    window.removeEventListener('focus', tickOnReturn);
    window.removeEventListener('online', tickOnReturn);
    window.removeEventListener('pageshow', tickOnReturn);
    document.removeEventListener('visibilitychange', onVisibilityChange);
}

/** Calls `listener` on every app refresh until the returned function is called. */
export function subscribeToAppRefresh(listener: Listener): () => void {
    if (listeners.size === 0) start();
    listeners.add(listener);
    // Validate kept snapshots on mount as well as on return from suspend.
    queueMicrotask(() => {
        if (listeners.has(listener) && canRefresh()) listener();
    });
    return () => {
        listeners.delete(listener);
        if (listeners.size === 0) stop();
    };
}
