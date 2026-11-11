import { useState } from 'react';
import { View } from 'react-native';

import { booleanStatColor } from '@/lib/statMorality';
import { formatTimeValue } from '@/lib/statValues';
import { useAppTheme } from '@/providers/ThemeProvider';
import { api } from '@/services/api';
import type { StatDefinition, StatEntry, StatEntryStatus, StatType } from '@/types/models';
import { AppButton } from '../ui/AppButton';
import { AppInput } from '../ui/AppInput';
import { AppPopup } from '../ui/AppPopup';
import { AppText } from '../ui/AppText';
import { ChoiceChips } from '../ui/ChoiceChips';
import { DurationInput } from './DurationInput';
import { TimePicker } from '../tasks/TaskScheduleField';
import { StatAdditionalInputControl } from './StatAdditionalInputControl';

function dateForMinutes(value: number): Date {
  const date = new Date();
  date.setHours(Math.floor(value / 60), value % 60, 0, 0);
  return date;
}

export function SubStatEntryControl({ definition, entry, date, onSaved }: {
  definition: StatDefinition;
  entry?: StatEntry;
  date: string;
  onSaved: (definitionId: string, entry: StatEntry | null, date: string) => void;
}) {
  const { colors } = useAppTheme();
  const [value, setValue] = useState<number | null>(entry?.value ?? null);
  const [valueText, setValueText] = useState(entry?.value == null ? '' : String(entry.value));
  const [status, setStatus] = useState<StatEntryStatus>(entry?.status ?? 'RECORDED');
  const [additionalValues, setAdditionalValues] = useState<Partial<Record<StatType, number>>>(entry?.additionalValues ?? {});
  const [timeValue, setTimeValue] = useState(() => dateForMinutes(definition.type === 'TIME' ? entry?.value ?? 12 * 60 : 12 * 60));
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [clearPending, setClearPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateValue(nextValue: number | null, nextStatus: StatEntryStatus = 'RECORDED') {
    setValue(nextValue);
    setStatus(nextStatus);
    setClearPending(false);
    setDirty(true);
    setError(null);
  }

  async function save() {
    if (saving || !dirty) return;
    const nextValue = clearPending ? null : definition.type === 'TIME'
      ? timeValue.getHours() * 60 + timeValue.getMinutes()
      : definition.type === 'NUMBER'
        ? valueText.trim() === '' ? null : Number(valueText)
        : value;
    if (nextValue !== null && !Number.isFinite(nextValue)) {
      setError('Enter a valid value.');
      return;
    }
    const nextAdditionalValues = status === 'NOT_PLANNED'
      ? {}
      : Object.fromEntries(
        (definition.additionalInputTypes ?? [])
          .filter(type => additionalValues[type] != null)
          .map(type => [type, additionalValues[type]]),
      ) as Partial<Record<StatType, number>>;
    if (nextValue === null && status !== 'NOT_PLANNED' && Object.keys(nextAdditionalValues).length > 0) {
      setError('Choose a value before saving these fields.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const recorded = await api.stats.record(
        definition.id,
        status === 'NOT_PLANNED' ? null : nextValue,
        date,
        status,
        nextAdditionalValues,
      );
      onSaved(definition.id, recorded ?? null, date);
      setValue(recorded?.value ?? null);
      setValueText(recorded?.value == null ? '' : String(recorded.value));
      setStatus(recorded?.status ?? 'RECORDED');
      setAdditionalValues(recorded?.additionalValues ?? nextAdditionalValues);
      setDirty(false);
      setClearPending(false);
    } catch (cause) {
      console.error('Failed to save mobile sub-stat entry:', cause);
      setError('Could not save this input. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const range = Array.from({ length: Math.min(20, Math.max(1, (definition.maxValue ?? 10) - (definition.minValue ?? 1) + 1)) },
    (_, index) => (definition.minValue ?? 1) + index);
  const booleanValue = status === 'NOT_PLANNED' ? -2 : value == null ? -1 : value;

  return (
    <View style={{ gap: 8 }}>
      <AppText variant="caption" color="muted">{definition.name}</AppText>
      {definition.type === 'BOOLEAN' ? (
        <ChoiceChips
          value={booleanValue}
          onChange={next => updateValue(next === -1 ? null : next === -2 ? 0 : next,
            next === -2 ? 'NOT_PLANNED' : 'RECORDED')}
          options={[
            { value: 1, label: 'Yes', color: booleanStatColor(definition, 1, colors) },
            { value: -2, label: 'Not planned', color: colors.notPlanned },
            { value: 0, label: 'No', color: booleanStatColor(definition, 0, colors) },
          ]}
        />
      ) : definition.type === 'RANGE' ? (
        <ChoiceChips value={value ?? -1} onChange={next => updateValue(next === -1 ? null : next)}
          options={[{ value: -1, label: '—' }, ...range.map(item => ({ value: item, label: String(item) }))]} />
      ) : definition.type === 'DURATION' ? (
        <DurationInput value={value} onChange={next => updateValue(next)} />
      ) : definition.type === 'TIME' ? (
        <>
          <AppButton variant="secondary" label={formatTimeValue(timeValue.getHours() * 60 + timeValue.getMinutes())}
            icon="time-outline" onPress={() => setTimePickerOpen(true)} />
          <AppPopup visible={timePickerOpen} title={`Choose ${definition.name.toLocaleLowerCase()}`} showIcon={false}
            onClose={() => setTimePickerOpen(false)} dismissOnBackdrop={false} scrollContent
            footer={<AppButton label="Done" onPress={() => { setTimePickerOpen(false); setDirty(true); setClearPending(false); }} />}>
            <TimePicker value={timeValue} onChange={next => { setTimeValue(next); setClearPending(false); }} />
          </AppPopup>
        </>
      ) : (
        <AppInput label={definition.unit ? `Value (${definition.unit})` : 'Value'} value={valueText}
          onChangeText={next => { setValueText(next); setDirty(true); setError(null); }} keyboardType="decimal-pad" />
      )}
      {(definition.additionalInputTypes ?? []).map(type => (
        <StatAdditionalInputControl
          key={`${definition.id}-${type}-${date}`}
          definition={definition}
          type={type}
          value={additionalValues[type] ?? null}
          onChange={nextValue => {
            setAdditionalValues(previous => {
              const next = { ...previous };
              if (nextValue == null) delete next[type];
              else next[type] = nextValue;
              return next;
            });
            setDirty(true);
            setClearPending(false);
            setError(null);
          }}
        />
      ))}
      {error && <AppText color="danger">{error}</AppText>}
      {(entry || value !== null) && (
        <AppButton compact variant="secondary" label="Clear input" disabled={saving}
          onPress={() => { setValue(null); setValueText(''); setStatus('RECORDED'); setClearPending(true); setDirty(true); }} />
      )}
      {dirty && <AppButton compact label="Save input" loading={saving} disabled={saving} onPress={() => void save()} />}
    </View>
  );
}
