export const SHOW_CLOSED_MENTAL_THREADS_STORAGE_KEY = 'showClosedMentalThreads';
import { getRuntimeUserPreference, updateRuntimeUserPreferences } from '../userPreferenceStore';

export function getShowClosedMentalThreads(): boolean {
    return getRuntimeUserPreference('showClosedMentalThreads');
}

export function setShowClosedMentalThreads(value: boolean): void {
    updateRuntimeUserPreferences({ showClosedMentalThreads: value });
}
