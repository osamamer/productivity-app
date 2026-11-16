let unavailable = false;
const listeners = new Set<() => void>();
export const isBackupFallbackNeeded = () => unavailable;
export const subscribeBackupAvailability = (listener: () => void) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
};
export function reportServerAvailability(available: boolean) {
    if (unavailable === !available) return;
    unavailable = !available;
    listeners.forEach(listener => listener());
}
