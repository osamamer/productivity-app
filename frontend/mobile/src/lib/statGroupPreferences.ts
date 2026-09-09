import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY_PREFIX = 'solife.stat-groups';

export function statGroupPreferencesStorageKey(userId: string | undefined): string {
  return `${STORAGE_KEY_PREFIX}.${userId ?? 'signed-out'}.open`;
}

function parseOpenGroupIds(stored: string | null): Set<string> {
  if (!stored) return new Set();

  try {
    const parsed: unknown = JSON.parse(stored);
    return new Set(
      Array.isArray(parsed) ? parsed.filter((groupId): groupId is string => typeof groupId === 'string') : [],
    );
  } catch (cause) {
    console.warn('Could not parse mobile statistic group display preferences:', cause);
    return new Set();
  }
}

export async function readOpenStatGroupIds(storageKey: string): Promise<Set<string>> {
  try {
    return parseOpenGroupIds(await AsyncStorage.getItem(storageKey));
  } catch (cause) {
    console.warn('Could not load mobile statistic group display preferences:', cause);
    return new Set();
  }
}

export async function writeOpenStatGroupIds(storageKey: string, groupIds: Set<string>): Promise<void> {
  try {
    await AsyncStorage.setItem(storageKey, JSON.stringify([...groupIds]));
  } catch (cause) {
    console.warn('Could not save mobile statistic group display preferences:', cause);
  }
}
