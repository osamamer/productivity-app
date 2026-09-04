export const MENTAL_DESTINATION_STORAGE_KEY = 'lastMentalDestination';

export const mentalDestinationPaths = [
    '/mental',
    '/mental-state',
    '/mental-threads',
    '/meditation',
] as const;

export type MentalDestinationPath = typeof mentalDestinationPaths[number];

export function isMentalDestinationPath(value: string | null): value is MentalDestinationPath {
    return value !== null && mentalDestinationPaths.includes(value as MentalDestinationPath);
}

export function getLastMentalDestination(): MentalDestinationPath | null {
    const storedPath = window.sessionStorage.getItem(MENTAL_DESTINATION_STORAGE_KEY);
    return isMentalDestinationPath(storedPath) ? storedPath : null;
}

export function rememberMentalDestination(path: MentalDestinationPath): void {
    window.sessionStorage.setItem(MENTAL_DESTINATION_STORAGE_KEY, path);
}
