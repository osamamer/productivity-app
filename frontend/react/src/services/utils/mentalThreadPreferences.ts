export const SHOW_CLOSED_MENTAL_THREADS_STORAGE_KEY = 'showClosedMentalThreads';

export function getShowClosedMentalThreads(): boolean {
    return window.localStorage.getItem(SHOW_CLOSED_MENTAL_THREADS_STORAGE_KEY) === 'true';
}

export function setShowClosedMentalThreads(value: boolean): void {
    window.localStorage.setItem(SHOW_CLOSED_MENTAL_THREADS_STORAGE_KEY, String(value));
}
