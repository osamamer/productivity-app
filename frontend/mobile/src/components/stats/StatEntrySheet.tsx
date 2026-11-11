import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { formatShortDate, localDate } from '@/lib/date';
import { readStatInputPreference, saveStatInputPreference } from '@/lib/inputPreferences';
import { booleanStatColor } from '@/lib/statMorality';
import { reportError } from '@/lib/errors';
import { formatTimeValue } from '@/lib/statValues';
import {
  applyOptimisticStatEntry,
  removeKnownStatEntry,
  registerStatEntries,
  rollbackOptimisticStatWrite,
  settleOptimisticStatWrite,
  type OptimisticStatWrite,
} from '@/lib/optimisticStats';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/providers/AuthProvider';
import { api } from '@/services/api';
import type { StatDefinition, StatEntry, StatEntryStatus, StatType } from '@/types/models';
import { AppButton } from '../ui/AppButton';
import { AppInput } from '../ui/AppInput';
import { AppText } from '../ui/AppText';
import { ChoiceChips } from '../ui/ChoiceChips';
import { DurationInput } from './DurationInput';
import { ModalSheet } from '../ui/ModalSheet';
import { AppPopup } from '../ui/AppPopup';
import { CalendarDatePicker } from '../ui/CalendarDatePicker';
import { TimePicker } from '../tasks/TaskScheduleField';
import { SubStatEntryControl } from './SubStatEntryControl';
import { StatAdditionalInputControl } from './StatAdditionalInputControl';

function dateForMinutes(value: number): Date {
  const date = new Date();
  date.setHours(Math.floor(value / 60), value % 60, 0, 0);
  return date;
}

function defaultValue(definition: StatDefinition, rememberedValue: number | null): number | null {
  if (definition.type === 'TIME') return rememberedValue ?? 12 * 60;
  if (definition.type === 'DURATION') return rememberedValue;
  return definition.minValue ?? 1;
}

export function StatEntrySheet({
  definition,
  subStatDefinitions = [],
  onSubEntrySaved,
  existing,
  initialDate,
  onClose,
  onSaved,
  onReverted,
}: {
  definition: StatDefinition | null;
  subStatDefinitions?: StatDefinition[];
  onSubEntrySaved?: (definitionId: string, entry: StatEntry | null, date: string) => void;
  existing?: StatEntry;
  initialDate?: string;
  onClose: () => void;
  onSaved: (entry: StatEntry | null, date?: string) => void;
  onReverted: (entry?: StatEntry, date?: string) => void;
}) {
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const firstEntryDate = existing?.date ?? initialDate ?? localDate();
  const [entryForDate, setEntryForDate] = useState<StatEntry | undefined>(existing);
  const [entryStatus, setEntryStatus] = useState<StatEntryStatus>(existing?.status ?? 'RECORDED');
  const [additionalValues, setAdditionalValues] = useState<Partial<Record<StatType, number>>>(existing?.additionalValues ?? {});
  const [value, setValue] = useState(existing?.value == null ? '' : String(existing.value));
  const [rangeValue, setRangeValue] = useState(existing?.value ?? definition?.minValue ?? 1);
  const [durationValue, setDurationValue] = useState<number | null>(definition?.type === 'DURATION' ? existing?.value ?? null : null);
  const [timeValue, setTimeValue] = useState(() => dateForMinutes(definition?.type === 'TIME' && existing?.value != null ? existing.value : 12 * 60));
  const [entryDate, setEntryDate] = useState(firstEntryDate);
  const [entriesForDate, setEntriesForDate] = useState<StatEntry[]>([]);
  const [entryLoading, setEntryLoading] = useState(Boolean(definition));
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadSequence = useRef(0);

  useEffect(() => {
    if (!definition) return;

    const sequence = loadSequence.current + 1;
    loadSequence.current = sequence;
    let active = true;
    void Promise.all([
      api.stats.entriesByDate(entryDate),
      definition.type === 'TIME' || definition.type === 'DURATION'
        ? readStatInputPreference(user?.id, definition.id, definition.type)
        : Promise.resolve(null),
    ]).then(([entries, rememberedValue]) => {
      if (!active || loadSequence.current !== sequence) return;
      const matchingEntry = entries.find(entry => entry.statDefinitionId === definition.id);
      setEntriesForDate(entries);
      const nextValue = matchingEntry?.value ?? defaultValue(definition, rememberedValue);
      setEntryForDate(matchingEntry);
      setEntryStatus(matchingEntry?.status ?? 'RECORDED');
      setAdditionalValues(matchingEntry?.additionalValues ?? {});
      setValue(nextValue == null ? '' : String(nextValue));
      setRangeValue(nextValue ?? definition.minValue ?? 1);
      setDurationValue(definition.type === 'DURATION' ? nextValue : null);
      setTimeValue(dateForMinutes(definition.type === 'TIME' && nextValue != null ? nextValue : 12 * 60));
    }).catch(cause => {
      if (active && loadSequence.current === sequence) setError(reportError('Could not load stat entry', cause));
    }).finally(() => {
      if (active && loadSequence.current === sequence) setEntryLoading(false);
    });

    return () => { active = false; };
  }, [definition, entryDate, user?.id]);

  function selectDate(nextDate: string) {
    if (nextDate === entryDate) return;
    setEntryDate(nextDate);
    setEntryLoading(true);
    setEntryForDate(undefined);
    setEntriesForDate([]);
    setEntryStatus('RECORDED');
    setAdditionalValues({});
    setValue('');
    setRangeValue(definition?.minValue ?? 1);
    setDurationValue(null);
    setTimeValue(dateForMinutes(12 * 60));
    setError(null);
  }

  function rememberValue(nextValue: number | null) {
    if (!definition || nextValue === null || (definition.type !== 'TIME' && definition.type !== 'DURATION')) return;
    void saveStatInputPreference(user?.id, definition.id, definition.type, nextValue);
  }

  async function save(nextValue?: number | null, nextStatus: StatEntryStatus = entryStatus) {
    if (!definition || saving || entryLoading) return;
    const numeric = nextValue !== undefined ? nextValue : (definition.type === 'RANGE'
      ? rangeValue
      : definition.type === 'DURATION'
        ? durationValue
        : definition.type === 'TIME'
          ? timeValue.getHours() * 60 + timeValue.getMinutes()
          : value.trim() === '' ? null : Number(value));
    if (numeric !== null && !Number.isFinite(numeric)) {
      setError(definition.type === 'DURATION' ? 'Enter a duration.' : definition.type === 'TIME' ? 'Choose a time.' : 'Enter a number.');
      return;
    }
    const isNotPlanned = nextStatus === 'NOT_PLANNED';
    const persistedValue = isNotPlanned ? 0 : numeric;
    const persistedAdditionalValues = isNotPlanned
      ? {}
      : Object.fromEntries(
        (definition.additionalInputTypes ?? [])
          .filter(type => additionalValues[type] != null)
          .map(type => [type, additionalValues[type]]),
      ) as Partial<Record<StatType, number>>;
    if (persistedValue === null && !isNotPlanned && Object.keys(persistedAdditionalValues).length > 0) {
      setError(`Choose a value for ${definition.name} before saving these fields.`);
      return;
    }
    const optimisticWrite: OptimisticStatWrite = applyOptimisticStatEntry(
      definition,
      entryDate,
      persistedValue,
      nextStatus,
      persistedAdditionalValues,
    );
    if (persistedValue === null) {
      onSaved(null, entryDate);
    } else {
      rememberValue(persistedValue);
      const optimistic: StatEntry = {
        id: entryForDate?.id ?? `optimistic-${definition.id}`,
        statDefinitionId: definition.id,
        statDefinition: definition,
        date: entryDate,
        value: persistedValue,
        additionalValues: persistedAdditionalValues,
        status: nextStatus,
        userId: entryForDate?.userId ?? definition.userId,
      };
      onSaved(optimistic);
    }
    setSaving(true);
    setError(null);
    try {
      const recorded = await api.stats.record(
        definition.id,
        persistedValue,
        entryDate,
        nextStatus,
        persistedAdditionalValues,
      );
      if (recorded) registerStatEntries([recorded]);
      else removeKnownStatEntry(definition.id, entryDate);
      settleOptimisticStatWrite(optimisticWrite);
      setEntryForDate(recorded);
      setEntryStatus(nextStatus);
      if (recorded) onSaved(recorded);
      if (subStatDefinitions.length === 0) onClose();
    } catch (cause) {
      rollbackOptimisticStatWrite(optimisticWrite);
      onReverted(entryForDate, entryDate);
      setError(reportError('Could not record stat', cause));
    } finally {
      setSaving(false);
    }
  }

  function handleSubEntrySaved(definitionId: string, entry: StatEntry | null, date: string) {
    setEntriesForDate(previous => [
      ...previous.filter(item => item.statDefinitionId !== definitionId),
      ...(entry ? [entry] : []),
    ]);
    onSubEntrySaved?.(definitionId, entry, date);
  }

  const min = definition?.minValue ?? 1;
  const max = definition?.maxValue ?? 10;
  const range = Array.from({ length: Math.min(20, Math.max(1, max - min + 1)) }, (_, index) => min + index);

  return (
    <ModalSheet visible={Boolean(definition)} onClose={onClose} title={definition?.name ?? 'Check in'}>
      {definition && (
        <View style={styles.dateSection}>
          <AppText variant="label">Date</AppText>
          <AppButton
            variant="secondary"
            label={entryDate === localDate() ? 'Today' : formatShortDate(entryDate)}
            icon="calendar-outline"
            onPress={() => setDatePickerOpen(true)}
          />
          <AppPopup
            visible={datePickerOpen}
            title="Choose date"
            showIcon={false}
            onClose={() => setDatePickerOpen(false)}
            dismissOnBackdrop={false}
            scrollContent
            footer={<AppButton label="Done" onPress={() => setDatePickerOpen(false)} />}
          >
            <CalendarDatePicker
              value={new Date(`${entryDate}T12:00:00`)}
              onChange={date => selectDate(localDate(date))}
            />
          </AppPopup>
        </View>
      )}
      {entryLoading && <AppText color="muted">Loading this date…</AppText>}
      {definition?.type === 'BOOLEAN' ? (
        <>
          <ChoiceChips
            value={entryStatus === 'NOT_PLANNED' ? -2 : value === '' ? -1 : Number(value)}
            onChange={next => {
              if (entryLoading) return;
              const nextStatus = next === -2 ? 'NOT_PLANNED' : 'RECORDED';
              const nextValue = next === -2 ? 0 : next;
              setValue(String(nextValue));
              setEntryStatus(nextStatus);
              if (subStatDefinitions.length === 0 && (definition.additionalInputTypes?.length ?? 0) === 0) {
                void save(next === -2 ? null : next, nextStatus);
              }
            }}
            options={[
              { value: 1, label: 'Yes', color: booleanStatColor(definition, 1, colors) },
              { value: -2, label: 'Not planned', color: colors.notPlanned },
              { value: 0, label: 'No', color: booleanStatColor(definition, 0, colors) },
            ]}
          />
        </>
      ) : definition?.type === 'RANGE' ? (
        <>
          <AppText variant="heading">{rangeValue}</AppText>
          <ChoiceChips value={rangeValue} onChange={setRangeValue} options={range.map(item => ({ value: item, label: String(item) }))} />
        </>
      ) : definition?.type === 'DURATION' ? (
        <>
          <DurationInput value={durationValue} onChange={next => { setDurationValue(next); rememberValue(next); }} autoFocus />
        </>
      ) : definition?.type === 'TIME' ? (
        <>
          <AppText variant="label">Time of day</AppText>
          <AppButton
            variant="secondary"
            label={formatTimeValue(timeValue.getHours() * 60 + timeValue.getMinutes())}
            icon="time-outline"
            onPress={() => setTimePickerOpen(true)}
          />
          <AppPopup
            visible={timePickerOpen}
            title="Choose time"
            showIcon={false}
            onClose={() => setTimePickerOpen(false)}
            dismissOnBackdrop={false}
            footer={<AppButton label="Done" onPress={() => setTimePickerOpen(false)} />}
          >
            <TimePicker value={timeValue} onChange={next => { setTimeValue(next); rememberValue(next.getHours() * 60 + next.getMinutes()); }} />
          </AppPopup>
        </>
      ) : (
        <AppInput autoFocus label="Value" value={value} onChangeText={setValue} keyboardType="decimal-pad" />
      )}
      {definition && (definition.additionalInputTypes ?? []).map(type => (
        <StatAdditionalInputControl
          key={`${definition.id}-${type}-${entryDate}`}
          definition={definition}
          type={type}
          value={additionalValues[type] ?? null}
          onChange={nextValue => setAdditionalValues(previous => {
            const next = { ...previous };
            if (nextValue == null) delete next[type];
            else next[type] = nextValue;
            return next;
          })}
        />
      ))}
      {definition && (definition.type !== 'BOOLEAN'
        || subStatDefinitions.length > 0
        || (definition.additionalInputTypes?.length ?? 0) > 0) && (
        <AppButton label="Record" loading={saving} disabled={entryLoading} onPress={() => void save()} />
      )}
      {subStatDefinitions.length > 0 && (
        <View style={{ gap: 12, marginTop: 8 }}>
          {entryLoading ? <AppText color="muted">Loading inputs…</AppText> : subStatDefinitions.map(subDefinition => {
            const subEntry = entriesForDate.find(entry => entry.statDefinitionId === subDefinition.id);
            return (
              <SubStatEntryControl
                key={`${subDefinition.id}-${entryDate}-${subEntry?.id ?? 'new'}-${subEntry?.value ?? ''}-${JSON.stringify(subEntry?.additionalValues ?? {})}`}
                definition={subDefinition}
                entry={subEntry}
                date={entryDate}
                onSaved={handleSubEntrySaved}
              />
            );
          })}
        </View>
      )}
      <AppButton
        label="Clear"
        variant="secondary"
        loading={saving}
        disabled={entryLoading || !entryForDate}
        onPress={() => void save(null)}
      />
      {error && <AppText color="danger">{error}</AppText>}
    </ModalSheet>
  );
}

const styles = {
  dateSection: { gap: 8 },
};
