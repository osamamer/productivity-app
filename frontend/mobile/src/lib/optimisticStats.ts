import { localDate } from './date';
import type { StatDefinition, StatEntry, StatEntryStatus } from '@/types/models';

type Override = { entry: StatEntry | null; sequence: number };

export interface OptimisticStatWrite {
  sequence: number;
  previous: Map<string, Override | undefined>;
}

const definitions = new Map<string, StatDefinition>();
const knownEntries = new Map<string, StatEntry>();
const overrides = new Map<string, Override>();
const listeners = new Set<() => void>();
let sequence = 0;

function key(definitionId: string, date: string): string {
  return `${definitionId}:${date}`;
}

function shiftDate(date: string, days: number): string {
  const shifted = new Date(`${date}T12:00:00`);
  shifted.setDate(shifted.getDate() + days);
  return localDate(shifted);
}

function notify(): void {
  listeners.forEach(listener => listener());
}

function setOverride(
  entryKey: string,
  entry: StatEntry | null,
  writeSequence: number,
  previous: Map<string, Override | undefined>,
): void {
  if (!previous.has(entryKey)) previous.set(entryKey, overrides.get(entryKey));
  overrides.set(entryKey, { entry, sequence: writeSequence });
}

function effectiveEntry(definitionId: string, date: string): StatEntry | null {
  const override = overrides.get(key(definitionId, date));
  return override ? override.entry : knownEntries.get(key(definitionId, date)) ?? null;
}

function optimisticEntry(
  definition: StatDefinition,
  date: string,
  value: number,
  status: StatEntryStatus,
): StatEntry {
  const existing = knownEntries.get(key(definition.id, date));
  return {
    ...(existing ?? {}),
    id: existing?.id ?? `optimistic-${definition.id}-${date}`,
    statDefinitionId: definition.id,
    statDefinition: definition,
    date,
    value,
    status,
    userId: existing?.userId ?? definition.userId,
  };
}

export function registerStatDefinitions(nextDefinitions: StatDefinition[]): void {
  nextDefinitions.forEach(definition => definitions.set(definition.id, definition));
}

export function registerStatEntries(
  entries: StatEntry[],
  definitionId?: string,
  from?: string,
  to?: string,
): void {
  if (definitionId && from && to) {
    const returnedKeys = new Set(entries.map(entry => key(entry.statDefinitionId, entry.date)));
    knownEntries.forEach((entry, entryKey) => {
      if (entry.statDefinitionId === definitionId
        && entry.date >= from
        && entry.date <= to
        && !returnedKeys.has(entryKey)) {
        knownEntries.delete(entryKey);
      }
    });
  }
  entries.forEach(entry => knownEntries.set(key(entry.statDefinitionId, entry.date), entry));
}

export function removeKnownStatEntry(definitionId: string, date: string): void {
  knownEntries.delete(key(definitionId, date));
}

export function subscribeToOptimisticStats(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function applyOptimisticStatEntry(
  definition: StatDefinition,
  date: string,
  value: number | null,
  status: StatEntryStatus = 'RECORDED',
): OptimisticStatWrite {
  definitions.set(definition.id, definition);
  const writeSequence = ++sequence;
  const previous = new Map<string, Override | undefined>();
  const persistedValue = status === 'NOT_PLANNED' ? 0 : value;
  const changedKey = key(definition.id, date);
  setOverride(
    changedKey,
    persistedValue === null ? null : optimisticEntry(definition, date, persistedValue, status),
    writeSequence,
    previous,
  );

  if (definition.systemKey === 'sleep_time' || definition.systemKey === 'wake_up_time') {
    const sleepDefinition = Array.from(definitions.values()).find(item => item.systemKey === 'sleep_time');
    const wakeUpDefinition = Array.from(definitions.values()).find(item => item.systemKey === 'wake_up_time');
    const durationDefinition = Array.from(definitions.values()).find(item => item.systemKey === 'sleep_hours');
    const sleepDate = definition.systemKey === 'sleep_time' ? date : shiftDate(date, -1);
    const wakeUpDate = shiftDate(sleepDate, 1);
    const sleepEntry = sleepDefinition && effectiveEntry(sleepDefinition.id, sleepDate);
    const wakeUpEntry = wakeUpDefinition && effectiveEntry(wakeUpDefinition.id, wakeUpDate);
    if (sleepDefinition && wakeUpDefinition && durationDefinition && sleepEntry && wakeUpEntry) {
      let durationMinutes = Math.round(wakeUpEntry.value) - Math.round(sleepEntry.value);
      if (durationMinutes <= 0) durationMinutes += 24 * 60;
      setOverride(
        key(durationDefinition.id, wakeUpDate),
        optimisticEntry(durationDefinition, wakeUpDate, durationMinutes, 'RECORDED'),
        writeSequence,
        previous,
      );
    }
  }

  notify();
  return { sequence: writeSequence, previous };
}

export function reconcileOptimisticStatEntries(
  entries: StatEntry[],
  from: string,
  to: string,
  definitionId?: string,
): StatEntry[] {
  const result = new Map(entries.map(entry => [key(entry.statDefinitionId, entry.date), entry]));
  knownEntries.forEach((entry, entryKey) => {
    if (definitionId && entry.statDefinitionId !== definitionId) return;
    if (entry.date >= from && entry.date <= to) result.set(entryKey, entry);
  });
  overrides.forEach((override, entryKey) => {
    const separatorIndex = entryKey.lastIndexOf(':');
    const overrideDefinitionId = entryKey.slice(0, separatorIndex);
    const date = entryKey.slice(separatorIndex + 1);
    if (definitionId && overrideDefinitionId !== definitionId) return;
    if (date < from || date > to) return;
    if (override.entry === null) result.delete(entryKey);
    else result.set(entryKey, override.entry);
  });
  return Array.from(result.values());
}

export function settleOptimisticStatWrite(write: OptimisticStatWrite): void {
  write.previous.forEach((_previous, entryKey) => {
    if (overrides.get(entryKey)?.sequence === write.sequence) overrides.delete(entryKey);
  });
  notify();
}

export function rollbackOptimisticStatWrite(write: OptimisticStatWrite): void {
  write.previous.forEach((previous, entryKey) => {
    if (overrides.get(entryKey)?.sequence !== write.sequence) return;
    if (previous) overrides.set(entryKey, previous);
    else overrides.delete(entryKey);
  });
  notify();
}
