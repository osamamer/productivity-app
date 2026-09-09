import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { formatShortDate, localDate } from '@/lib/date';
import { readStatInputPreference, saveStatInputPreference } from '@/lib/inputPreferences';
import { reportError } from '@/lib/errors';
import { formatTimeValue } from '@/lib/statValues';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/providers/AuthProvider';
import { api } from '@/services/api';
import type { StatDefinition, StatEntry } from '@/types/models';
import { AppButton } from '../ui/AppButton';
import { AppInput } from '../ui/AppInput';
import { AppText } from '../ui/AppText';
import { ChoiceChips } from '../ui/ChoiceChips';
import { DurationInput } from './DurationInput';
import { ModalSheet } from '../ui/ModalSheet';
import { AppPopup } from '../ui/AppPopup';
import { CalendarDatePicker } from '../ui/CalendarDatePicker';
import { TimePicker } from '../tasks/TaskScheduleField';

function dateForMinutes(value: number): Date {
  const date = new Date();
  date.setHours(Math.floor(value / 60), value % 60, 0, 0);
  return date;
}

function booleanChoiceColor(
  definition: StatDefinition,
  value: 0 | 1,
  colors: ReturnType<typeof useAppTheme>['colors'],
): string {
  const morality = definition.morality ?? 'NEUTRAL';
  if (morality === 'NEUTRAL') return value === 1 ? colors.accent : colors.secondary;
  if (morality === 'GOOD') return value === 1 ? colors.success : colors.danger;
  return value === 1 ? colors.danger : colors.success;
}

function defaultValue(definition: StatDefinition, rememberedValue: number | null): number | null {
  if (definition.type === 'TIME') return rememberedValue ?? 12 * 60;
  if (definition.type === 'DURATION') return rememberedValue;
  return definition.minValue ?? 1;
}

export function StatEntrySheet({ definition, existing, onClose, onSaved, onReverted }: {
  definition: StatDefinition | null;
  existing?: StatEntry;
  onClose: () => void;
  onSaved: (entry: StatEntry) => void;
  onReverted: (entry?: StatEntry, date?: string) => void;
}) {
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const initialDate = existing?.date ?? localDate();
  const [entryForDate, setEntryForDate] = useState<StatEntry | undefined>(existing);
  const [value, setValue] = useState(existing?.value == null ? '' : String(existing.value));
  const [rangeValue, setRangeValue] = useState(existing?.value ?? definition?.minValue ?? 1);
  const [durationValue, setDurationValue] = useState<number | null>(definition?.type === 'DURATION' ? existing?.value ?? null : null);
  const [timeValue, setTimeValue] = useState(() => dateForMinutes(definition?.type === 'TIME' && existing?.value != null ? existing.value : 12 * 60));
  const [entryDate, setEntryDate] = useState(initialDate);
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
      const nextValue = matchingEntry?.value ?? defaultValue(definition, rememberedValue);
      setEntryForDate(matchingEntry);
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

  async function save(nextValue?: number) {
    if (!definition || saving || entryLoading) return;
    const numeric = nextValue ?? (definition.type === 'RANGE'
      ? rangeValue
      : definition.type === 'DURATION'
        ? durationValue
        : definition.type === 'TIME'
          ? timeValue.getHours() * 60 + timeValue.getMinutes()
          : Number(value));
    if (numeric === null || !Number.isFinite(numeric)) {
      setError(definition.type === 'DURATION' ? 'Enter a duration.' : definition.type === 'TIME' ? 'Choose a time.' : 'Enter a number.');
      return;
    }
    rememberValue(numeric);
    const optimistic: StatEntry = {
      id: entryForDate?.id ?? `optimistic-${definition.id}`,
      statDefinitionId: definition.id,
      statDefinition: definition,
      date: entryDate,
      value: numeric,
      userId: entryForDate?.userId ?? definition.userId,
    };
    onSaved(optimistic);
    setSaving(true);
    setError(null);
    try {
      const recorded = await api.stats.record(definition.id, numeric, entryDate);
      setEntryForDate(recorded);
      onSaved(recorded);
      onClose();
    } catch (cause) {
      onReverted(entryForDate, entryDate);
      setError(reportError('Could not record stat', cause));
    } finally {
      setSaving(false);
    }
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
        <ChoiceChips
          value={value === '' ? -1 : Number(value)}
          onChange={next => {
            if (entryLoading) return;
            setValue(String(next));
            void save(next);
          }}
          options={[
            { value: 1, label: 'Yes', color: booleanChoiceColor(definition, 1, colors) },
            { value: 0, label: 'No', color: booleanChoiceColor(definition, 0, colors) },
          ]}
        />
      ) : definition?.type === 'RANGE' ? (
        <>
          <AppText variant="heading">{rangeValue}</AppText>
          <ChoiceChips value={rangeValue} onChange={setRangeValue} options={range.map(item => ({ value: item, label: String(item) }))} />
          <AppButton label="Record" loading={saving} disabled={entryLoading} onPress={() => void save()} />
        </>
      ) : definition?.type === 'DURATION' ? (
        <>
          <DurationInput value={durationValue} onChange={next => { setDurationValue(next); rememberValue(next); }} autoFocus />
          <AppButton label="Record" loading={saving} disabled={entryLoading} onPress={() => void save()} />
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
          <AppButton label="Record" loading={saving} disabled={entryLoading} onPress={() => void save()} />
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
        <>
          <AppInput autoFocus label="Value" value={value} onChangeText={setValue} keyboardType="decimal-pad" />
          <AppButton label="Record" loading={saving} disabled={entryLoading} onPress={() => void save()} />
        </>
      )}
      {error && <AppText color="danger">{error}</AppText>}
    </ModalSheet>
  );
}

const styles = {
  dateSection: { gap: 8 },
};
