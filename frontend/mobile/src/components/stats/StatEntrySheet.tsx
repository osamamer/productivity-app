import { useState } from 'react';

import { localDate } from '@/lib/date';
import { reportError } from '@/lib/errors';
import { useAppTheme } from '@/providers/ThemeProvider';
import { api } from '@/services/api';
import type { StatDefinition, StatEntry } from '@/types/models';
import { AppButton } from '../ui/AppButton';
import { AppInput } from '../ui/AppInput';
import { AppText } from '../ui/AppText';
import { ChoiceChips } from '../ui/ChoiceChips';
import { DurationInput } from './DurationInput';
import { ModalSheet } from '../ui/ModalSheet';

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

export function StatEntrySheet({ definition, existing, onClose, onSaved, onReverted }: {
  definition: StatDefinition | null;
  existing?: StatEntry;
  onClose: () => void;
  onSaved: (entry: StatEntry) => void;
  onReverted: (entry?: StatEntry) => void;
}) {
  const { colors } = useAppTheme();
  const initialValue = existing?.value
    ?? (definition?.type === 'DURATION' ? null : definition?.minValue ?? 1);
  const [value, setValue] = useState(initialValue == null ? '' : String(initialValue));
  const [rangeValue, setRangeValue] = useState(initialValue ?? 1);
  const [durationValue, setDurationValue] = useState<number | null>(definition?.type === 'DURATION' ? initialValue : null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(nextValue?: number) {
    if (!definition || saving) return;
    const numeric = nextValue ?? (definition.type === 'RANGE'
      ? rangeValue
      : definition.type === 'DURATION'
        ? durationValue
        : Number(value));
    if (numeric === null || !Number.isFinite(numeric)) {
      return setError(definition.type === 'DURATION' ? 'Enter a duration.' : 'Enter a number.');
    }
    const optimistic: StatEntry = {
      id: existing?.id ?? `optimistic-${definition.id}`,
      statDefinitionId: definition.id,
      statDefinition: definition,
      date: existing?.date ?? localDate(),
      value: numeric,
      userId: existing?.userId ?? definition.userId,
    };
    onSaved(optimistic);
    setSaving(true); setError(null);
    try { onSaved(await api.stats.record(definition.id, numeric)); onClose(); }
    catch (cause) {
      onReverted(existing);
      setError(reportError('Could not record stat', cause));
    }
    finally { setSaving(false); }
  }

  const min = definition?.minValue ?? 1;
  const max = definition?.maxValue ?? 10;
  const range = Array.from({ length: Math.min(20, Math.max(1, max - min + 1)) }, (_, index) => min + index);

  return (
    <ModalSheet visible={Boolean(definition)} onClose={onClose} title={definition?.name ?? 'Check in'}>
      {definition?.type === 'BOOLEAN' ? (
        <ChoiceChips
          value={existing?.value ?? -1}
          onChange={next => void save(next)}
          options={[
            { value: 1, label: 'Yes', color: booleanChoiceColor(definition, 1, colors) },
            { value: 0, label: 'No', color: booleanChoiceColor(definition, 0, colors) },
          ]}
        />
      ) : definition?.type === 'RANGE' ? (
        <>
          <AppText variant="heading">{rangeValue}</AppText>
          <ChoiceChips value={rangeValue} onChange={setRangeValue} options={range.map(item => ({ value: item, label: String(item) }))} />
          <AppButton label="Record" loading={saving} onPress={() => void save()} />
        </>
      ) : definition?.type === 'DURATION' ? (
        <>
          <DurationInput value={durationValue} onChange={setDurationValue} autoFocus />
          <AppButton label="Record" loading={saving} onPress={() => void save()} />
        </>
      ) : (
        <>
          <AppInput autoFocus label="Value" value={value} onChangeText={setValue} keyboardType="decimal-pad" />
          <AppButton label="Record" loading={saving} onPress={() => void save()} />
        </>
      )}
      {error && <AppText color="danger">{error}</AppText>}
    </ModalSheet>
  );
}
