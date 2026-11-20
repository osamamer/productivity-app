// Whether the server answers. Once it stops answering, a health check runs every few seconds until it
// does; the bar must not stay up just because no page happens to fetch anything.
const PROBE_INTERVAL_MS = 10_000;

let unavailable = false;
let probe: (() => Promise<unknown>) | null = null;
let probeTimer: number | undefined;
const listeners = new Set<() => void>();

export const isBackupFallbackNeeded = () => unavailable;
export const subscribeBackupAvailability = (listener: () => void) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
};

/** The request that checks the server; its successful response reports availability back here. */
export function setServerProbe(next: () => Promise<unknown>) {
    probe = next;
}

function probeNow() {
    probe?.().catch(() => undefined);
}

export function reportServerAvailability(available: boolean) {
    if (unavailable === !available) return;
    unavailable = !available;
    if (unavailable) {
        probeTimer = window.setInterval(probeNow, PROBE_INTERVAL_MS);
    } else {
        window.clearInterval(probeTimer);
        probeTimer = undefined;
    }
    listeners.forEach(listener => listener());
}
