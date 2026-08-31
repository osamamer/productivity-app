import { useState } from 'react';

import { api } from '@/services/api';
import type { StatDefinition, StatEntry } from '@/types/models';
import { AppButton } from '../ui/AppButton';
import { AppInput } from '../ui/AppInput';
import { AppText } from '../ui/AppText';
import { ChoiceChips } from '../ui/ChoiceChips';
import { ModalSheet } from '../ui/ModalSheet';

export function StatEntrySheet({ definition, existing, onClose, onSaved }: {
  definition: StatDefinition | null;
  existing?: StatEntry;
  onClose: () => void;
  onSaved: (entry: StatEntry) => void;
}) {
  const initialValue = existing?.value ?? definition?.minValue ?? 1;
  const [value, setValue] = useState(String(initialValue));
  const [rangeValue, setRangeValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(nextValue?: number) {
    if (!definition) return;
    const numeric = nextValue ?? Number(definition.type === 'RANGE' ? rangeValue : value);
    if (!Number.isFinite(numeric)) return setError('Enter a number.');
    setSaving(true); setError(null);
    try { onSaved(await api.stats.record(definition.id, numeric)); onClose(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not record this stat.'); }
    finally { setSaving(false); }
  }

  const min = definition?.minValue ?? 1;
  const max = definition?.maxValue ?? 10;
  const range = Array.from({ length: Math.min(20, Math.max(1, max - min + 1)) }, (_, index) => min + index);

  return (
    <ModalSheet visible={Boolean(definition)} onClose={onClose} title={definition?.name ?? 'Check in'}>
      {definition?.description && <AppText color="muted">{definition.description}</AppText>}
      {definition?.type === 'BOOLEAN' ? (
        <ChoiceChips value={existing?.value ?? -1} onChange={next => void save(next)} options={[{ value: 1, label: 'Yes' }, { value: 0, label: 'No' }]} />
      ) : definition?.type === 'RANGE' ? (
        <>
          <AppText variant="heading">{rangeValue}</AppText>
          <ChoiceChips value={rangeValue} onChange={setRangeValue} options={range.map(item => ({ value: item, label: String(item) }))} />
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
