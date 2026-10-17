import { useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { reportError } from '@/lib/errors';
import { formatTimeValue } from '@/lib/statValues';
import { api } from '@/services/api';
import type { StatDefinition, StatMorality, StatType } from '@/types/models';
import { AppButton } from '../ui/AppButton';
import { AppInput } from '../ui/AppInput';
import { AppPopup } from '../ui/AppPopup';
import { AppText } from '../ui/AppText';
import { ChoiceChips } from '../ui/ChoiceChips';
import { ModalSheet } from '../ui/ModalSheet';
import { DurationInput } from './DurationInput';
import { TimePicker } from '../tasks/TaskScheduleField';

function dateForMinutes(value: number): Date {
  const date = new Date();
  date.setHours(Math.floor(value / 60), value % 60, 0, 0);
  return date;
}

export function StatComposerSheet({ visible, definition, onClose, onCreated, onUpdated }: {
  visible: boolean;
  definition?: StatDefinition | null;
  onClose: () => void;
  onCreated: (definition: StatDefinition) => void;
  onUpdated?: (definition: StatDefinition) => void;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<StatType>('BOOLEAN');
  const [min, setMin] = useState('1');
  const [max, setMax] = useState('10');
  const [morality, setMorality] = useState<StatMorality>('NEUTRAL');
  const [threshold, setThreshold] = useState('');
  const [durationThreshold, setDurationThreshold] = useState<number | null>(null);
  const [timeThreshold, setTimeThreshold] = useState(() => dateForMinutes(12 * 60));
  const [thresholdPickerOpen, setThresholdPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameInputRef = useRef<TextInput>(null);
  const editing = Boolean(definition);

  useEffect(() => {
    if (!visible) return undefined;

    const definitionType = definition?.type ?? 'BOOLEAN';
    const definitionThreshold = definition?.goodThreshold ?? null;
    const setupTimer = setTimeout(() => {
      setName(definition?.name ?? '');
      setType(definitionType);
      setMin(definition?.minValue == null ? '1' : String(definition.minValue));
      setMax(definition?.maxValue == null ? '10' : String(definition.maxValue));
      setMorality(definition?.morality ?? 'NEUTRAL');
      setThreshold(definitionType === 'TIME' || definitionType === 'DURATION' || definitionThreshold == null
        ? ''
        : String(definitionThreshold));
      setDurationThreshold(definitionType === 'DURATION' ? definitionThreshold : null);
      setTimeThreshold(dateForMinutes(definitionType === 'TIME' && definitionThreshold != null ? definitionThreshold : 12 * 60));
      setThresholdPickerOpen(false);
      setError(null);
    }, 0);
    const focusTimer = setTimeout(() => nameInputRef.current?.focus(), 220);
    return () => {
      clearTimeout(setupTimer);
      clearTimeout(focusTimer);
    };
  }, [definition, visible]);

  function close() {
    setThresholdPickerOpen(false);
    setError(null);
    onClose();
  }

  function thresholdValue(): number | null {
    if (type === 'TIME') return timeThreshold.getHours() * 60 + timeThreshold.getMinutes();
    if (type === 'DURATION') return durationThreshold;
    if (!threshold.trim()) return null;
    const value = Number(threshold);
    return Number.isFinite(value) ? value : null;
  }

  async function submit() {
    if (!name.trim()) {
      setError('Give the stat a name.');
      return;
    }

    const minValue = type === 'RANGE' ? Number(min) : undefined;
    const maxValue = type === 'RANGE' ? Number(max) : undefined;
    if (!editing && type === 'RANGE' && (!Number.isFinite(minValue) || !Number.isFinite(maxValue) || minValue! >= maxValue!)) {
      setError('Use a valid minimum below the maximum.');
      return;
    }

    const effectiveMorality = type === 'TIME' && morality === 'BAD' ? 'GOOD' : morality;
    const goodThreshold = effectiveMorality === 'NEUTRAL' || type === 'BOOLEAN' ? null : thresholdValue();
    if (effectiveMorality !== 'NEUTRAL' && type !== 'BOOLEAN' && goodThreshold == null) {
      setError(type === 'DURATION' ? 'Enter a duration threshold.' : type === 'TIME' ? 'Choose a time threshold.' : 'Enter a numeric threshold.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (definition) {
        const updated = await api.stats.update(definition.id, {
          name: name.trim(),
          morality: effectiveMorality,
          goodThreshold,
        });
        onUpdated?.(updated);
      } else {
        const created = await api.stats.create({
          name: name.trim(),
          type,
          minValue,
          maxValue,
          morality: effectiveMorality,
          goodThreshold,
        });
        onCreated(created);
      }
      close();
    } catch (cause) {
      setError(reportError(`Could not ${editing ? 'update' : 'create'} stat`, cause));
    } finally {
      setSaving(false);
    }
  }

  const thresholdVisible = type !== 'BOOLEAN' && morality !== 'NEUTRAL';

  return (
    <ModalSheet
      visible={visible}
      onClose={close}
      title={editing ? 'Edit stat' : 'New stat'}
      footer={<AppButton label={editing ? 'Save changes' : 'Create stat'} loading={saving} onPress={() => void submit()} />}>
      <AppInput ref={nameInputRef} autoFocus label="Name" value={name} onChangeText={setName} error={error ?? undefined} />
      {!editing && <>
        <AppText variant="label">Type</AppText>
        <ChoiceChips value={type} onChange={next => {
          setType(next);
          setMorality(next === 'BOOLEAN' ? 'NEUTRAL' : next === 'TIME' && morality === 'BAD' ? 'GOOD' : morality);
          setThreshold('');
          setDurationThreshold(null);
        }} options={[
          { value: 'BOOLEAN' as const, label: 'Yes / No' },
          { value: 'NUMBER' as const, label: 'Number' },
          { value: 'RANGE' as const, label: 'Range' },
          { value: 'TIME' as const, label: 'Time of day' },
          { value: 'DURATION' as const, label: 'Duration' },
        ]} />
      </>}
      {!editing && type === 'RANGE' && (
        <View style={styles.rangeRow}>
          <AppInput containerStyle={styles.rangeInput} label="Minimum" value={min} onChangeText={setMin} keyboardType="decimal-pad" />
          <AppInput containerStyle={styles.rangeInput} label="Maximum" value={max} onChangeText={setMax} keyboardType="decimal-pad" />
        </View>
      )}
      <AppText variant="label">Meaning of the value</AppText>
      <ChoiceChips
        value={type === 'TIME' && morality === 'BAD' ? 'GOOD' : morality}
        onChange={setMorality}
        options={type === 'TIME' ? [
          { value: 'GOOD' as const, label: 'Earlier is better' },
          { value: 'NEUTRAL' as const, label: 'Neutral' },
        ] : [
          { value: 'GOOD' as const, label: 'Higher is better' },
          { value: 'BAD' as const, label: 'Lower is better' },
          { value: 'NEUTRAL' as const, label: 'Neutral' },
        ]}
      />
      {thresholdVisible && type === 'TIME' && (
        <>
          <AppText variant="caption" color="muted">Time threshold</AppText>
          <AppButton variant="secondary" label={formatTimeValue(timeThreshold.getHours() * 60 + timeThreshold.getMinutes())} icon="time-outline" onPress={() => setThresholdPickerOpen(true)} />
        </>
      )}
      {thresholdVisible && type === 'DURATION' && (
        <DurationInput value={durationThreshold} onChange={setDurationThreshold} />
      )}
      {thresholdVisible && type !== 'TIME' && type !== 'DURATION' && (
        <AppInput label={morality === 'BAD' ? 'Threshold at or below' : 'Threshold at or above'} value={threshold} onChangeText={setThreshold} keyboardType="decimal-pad" />
      )}
      {error && <AppText variant="caption" color="danger">{error}</AppText>}
      <AppPopup
        visible={thresholdPickerOpen}
        title="Time threshold"
        showIcon={false}
        onClose={() => setThresholdPickerOpen(false)}
        dismissOnBackdrop={false}
        footer={<AppButton label="Done" onPress={() => setThresholdPickerOpen(false)} />}>
        <TimePicker value={timeThreshold} onChange={setTimeThreshold} />
      </AppPopup>
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  rangeRow: { flexDirection: 'row', gap: 10 },
  rangeInput: { flex: 1 },
});
