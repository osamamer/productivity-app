import { getAuthCacheScope } from '../../services/utils/authHeaders';
import type { ActiveExpansion } from './homeTypes';

export const HOME_ACTIVE_EXPANSION_STORAGE_KEY = 'home-active-expansion';

export function homeActiveExpansionStorageKey(): string {
    return `claritard:${getAuthCacheScope()}:${HOME_ACTIVE_EXPANSION_STORAGE_KEY}`;
}

export function readHomeActiveExpansion(): ActiveExpansion {
    if (typeof window === 'undefined') return null;

    try {
        const raw = window.sessionStorage.getItem(homeActiveExpansionStorageKey());
        if (!raw) return null;

        const parsed = JSON.parse(raw) as Partial<NonNullable<ActiveExpansion>>;
        if (typeof parsed.taskId !== 'string'
            || parsed.taskId.length === 0
            || (parsed.panel !== 'pomodoro' && parsed.panel !== 'details')) {
            return null;
        }
        return { taskId: parsed.taskId, panel: parsed.panel };
    } catch (error) {
        console.warn('Could not restore the expanded Home task:', error);
        return null;
    }
}
