import AsyncStorage from '@react-native-async-storage/async-storage';

export type TaskSectionName = 'today' | 'comingUp' | 'leftovers' | 'undated';
export type TaskSectionExpansionState = Record<TaskSectionName, boolean>;

const STORAGE_KEY_PREFIX = 'solife.task-page-sections';

export const DEFAULT_TASK_SECTION_EXPANSION: TaskSectionExpansionState = {
  today: true,
  comingUp: true,
  leftovers: false,
  undated: false,
};

function storageKey(userId: string | undefined): string {
  return `${STORAGE_KEY_PREFIX}.${userId ?? 'signed-out'}`;
}

function defaultExpansion(): TaskSectionExpansionState {
  return { ...DEFAULT_TASK_SECTION_EXPANSION };
}

export async function readTaskSectionExpansion(userId: string | undefined): Promise<TaskSectionExpansionState> {
  try {
    const stored = await AsyncStorage.getItem(storageKey(userId));
    if (!stored) return defaultExpansion();

    const parsed: unknown = JSON.parse(stored);
    if (!parsed || typeof parsed !== 'object') return defaultExpansion();

    const storedSections = parsed as Partial<Record<TaskSectionName, unknown>>;
    return {
      today: typeof storedSections.today === 'boolean' ? storedSections.today : DEFAULT_TASK_SECTION_EXPANSION.today,
      comingUp: typeof storedSections.comingUp === 'boolean' ? storedSections.comingUp : DEFAULT_TASK_SECTION_EXPANSION.comingUp,
      leftovers: typeof storedSections.leftovers === 'boolean' ? storedSections.leftovers : DEFAULT_TASK_SECTION_EXPANSION.leftovers,
      undated: typeof storedSections.undated === 'boolean' ? storedSections.undated : DEFAULT_TASK_SECTION_EXPANSION.undated,
    };
  } catch (cause) {
    console.warn('Could not read mobile task section preferences:', cause);
    return defaultExpansion();
  }
}

export async function saveTaskSectionExpansion(
  userId: string | undefined,
  state: TaskSectionExpansionState,
): Promise<void> {
  try {
    await AsyncStorage.setItem(storageKey(userId), JSON.stringify(state));
  } catch (cause) {
    console.warn('Could not save mobile task section preferences:', cause);
  }
}
