export type TaskSectionName = 'today' | 'comingUp' | 'leftovers' | 'undated';
export type TaskSectionExpansionState = Record<TaskSectionName, boolean>;

export const TASK_SECTION_EXPANSION_STORAGE_KEY = 'taskPageSectionExpansion';

export const DEFAULT_TASK_SECTION_EXPANSION: TaskSectionExpansionState = {
    today: true,
    comingUp: true,
    leftovers: false,
    undated: false,
};

function defaultTaskSectionExpansion(): TaskSectionExpansionState {
    return { ...DEFAULT_TASK_SECTION_EXPANSION };
}

export function readTaskSectionExpansion(): TaskSectionExpansionState {
    try {
        const storedValue = window.localStorage.getItem(TASK_SECTION_EXPANSION_STORAGE_KEY);
        if (!storedValue) return defaultTaskSectionExpansion();

        const parsedValue: unknown = JSON.parse(storedValue);
        if (!parsedValue || typeof parsedValue !== 'object') {
            return defaultTaskSectionExpansion();
        }

        const storedSections = parsedValue as Partial<Record<TaskSectionName, unknown>>;
        return {
            today: typeof storedSections.today === 'boolean'
                ? storedSections.today
                : DEFAULT_TASK_SECTION_EXPANSION.today,
            comingUp: typeof storedSections.comingUp === 'boolean'
                ? storedSections.comingUp
                : DEFAULT_TASK_SECTION_EXPANSION.comingUp,
            leftovers: typeof storedSections.leftovers === 'boolean'
                ? storedSections.leftovers
                : DEFAULT_TASK_SECTION_EXPANSION.leftovers,
            undated: typeof storedSections.undated === 'boolean'
                ? storedSections.undated
                : DEFAULT_TASK_SECTION_EXPANSION.undated,
        };
    } catch (error) {
        console.warn('Unable to read task section preferences from local storage.', error);
        return defaultTaskSectionExpansion();
    }
}

export function saveTaskSectionExpansion(state: TaskSectionExpansionState): void {
    try {
        window.localStorage.setItem(TASK_SECTION_EXPANSION_STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
        console.warn('Unable to save task section preferences to local storage.', error);
    }
}
