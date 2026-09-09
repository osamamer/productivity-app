import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { reportError } from '@/lib/errors';
import { formatDurationValue, formatTimeValue } from '@/lib/statValues';
import { readStatInputPreference, saveStatInputPreference } from '@/lib/inputPreferences';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/providers/AuthProvider';
import { api } from '@/services/api';
import type { StatDefinition, StatEntryStatus } from '@/types/models';
import { AppButton } from '../ui/AppButton';
import { AppInput } from '../ui/AppInput';
import { AppSlider } from '../ui/AppSlider';
import { AppText } from '../ui/AppText';
import { ChoiceChips } from '../ui/ChoiceChips';
import { ModalSheet } from '../ui/ModalSheet';
import { DurationInput } from '../stats/DurationInput';
import { AppPopup } from '../ui/AppPopup';
import { TimePicker } from '../tasks/TaskScheduleField';

function booleanColor(definition: StatDefinition, value: 0 | 1, colors: ReturnType<typeof useAppTheme>['colors']): string {
  const morality = definition.morality ?? 'NEUTRAL';
  if (morality === 'NEUTRAL') return value === 1 ? colors.accent : colors.secondary;
  if (morality === 'GOOD') return value === 1 ? colors.success : colors.danger;
  return value === 1 ? colors.danger : colors.success;
}

function formatValue(definition: StatDefinition, value: number): string {
  if (definition.type === 'TIME') return formatTimeValue(value);
  if (definition.type === 'DURATION') return formatDurationValue(value);
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function dateForMinutes(value: number | null | undefined): Date {
  const date = new Date();
  const minutes = value ?? 12 * 60;
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return date;
}

function TimeValueField({ value, onChange }: { value: number | null | undefined; onChange: (value: number) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => dateForMinutes(value));

  function openPicker() {
    setDraft(dateForMinutes(value));
    setOpen(true);
  }

  return (
    <>
      <AppButton
        variant="secondary"
        label={value == null ? 'Choose time' : formatTimeValue(value)}
        icon="time-outline"
        onPress={openPicker}
      />
      <AppPopup
        visible={open}
        title="Choose time"
        showIcon={false}
        onClose={() => setOpen(false)}
        dismissOnBackdrop={false}
        footer={<AppButton label="Done" onPress={() => setOpen(false)} />}
      >
        <TimePicker value={draft} onChange={next => {
          setDraft(next);
          onChange(next.getHours() * 60 + next.getMinutes());
        }} />
      </AppPopup>
    </>
  );
}

export function CalendarStatCheckInSheet({ date, definitions, onClose, onSaved }: {
  date: string | null;
  definitions: StatDefinition[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const [values, setValues] = useState<Record<string, number | null>>({});
  const [statuses, setStatuses] = useState<Record<string, StatEntryStatus>>({});
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(() => Boolean(date && definitions.length > 0));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!date || definitions.length === 0) {
      return;
    }

    let active = true;
    void api.stats.entriesByDate(date)
      .then(async entries => {
        if (!active) return;
        const nextValues: Record<string, number | null> = {};
        const nextStatuses: Record<string, StatEntryStatus> = {};
        const nextTouched = new Set<string>();
        const rememberedValues = await Promise.all(definitions.map(async definition => ({
          definition,
          value: definition.type === 'TIME' || definition.type === 'DURATION'
            ? await readStatInputPreference(user?.id, definition.id, definition.type)
            : null,
        })));
        if (!active) return;
        rememberedValues.forEach(({ definition, value }) => { nextValues[definition.id] = value; });
        definitions.forEach(definition => { nextStatuses[definition.id] = 'RECORDED'; });
        entries.forEach(entry => {
          nextValues[entry.statDefinitionId] = entry.value;
          nextStatuses[entry.statDefinitionId] = entry.status ?? 'RECORDED';
          nextTouched.add(entry.statDefinitionId);
        });
        setValues(nextValues);
        setStatuses(nextStatuses);
        setTouched(nextTouched);
      })
      .catch(cause => {
        if (active) setError(reportError('Could not load statistics', cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [date, definitions, user?.id]);

  function updateValue(id: string, value: number | null, status: StatEntryStatus = 'RECORDED') {
    setValues(previous => ({ ...previous, [id]: value }));
    setStatuses(previous => ({ ...previous, [id]: status }));
    const definition = definitions.find(item => item.id === id);
    if (value !== null && (definition?.type === 'TIME' || definition?.type === 'DURATION')) {
      void saveStatInputPreference(user?.id, id, definition.type, value);
    }
    setTouched(previous => {
      const next = new Set(previous);
      next.add(id);
      return next;
    });
  }

  async function save() {
    if (!date || saving || touched.size === 0) return;
    setSaving(true);
    setError(null);
    try {
      await Promise.all(definitions
        .filter(definition => touched.has(definition.id))
        .map(definition => api.stats.record(
          definition.id,
          statuses[definition.id] === 'NOT_PLANNED' ? 0 : values[definition.id] ?? null,
          date,
          statuses[definition.id],
        )));
      onSaved();
      onClose();
    } catch (cause) {
      setError(reportError('Could not save statistics', cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalSheet
      visible={Boolean(date)}
      onClose={onClose}
      title={date ? `Stats · ${date}` : 'Stats'}
      footer={<AppButton label="Save stats" loading={saving} disabled={loading || touched.size === 0} onPress={() => void save()} />}>
      {loading && <AppText color="muted">Loading existing entries…</AppText>}
      {!loading && definitions.length === 0 && <AppText color="muted">No stat definitions yet. Create some on the Stats page.</AppText>}
      {!loading && definitions.map(definition => {
        const value = values[definition.id];
        const min = definition.minValue ?? 1;
        const max = definition.maxValue ?? 10;
        return (
          <View key={definition.id} style={styles.definition}>
            <View style={styles.definitionHeading}>
              <AppText variant="label">{definition.name}</AppText>
              {value !== null && value !== undefined && <AppText variant="caption" color="muted">{formatValue(definition, value)}</AppText>}
            </View>
            {definition.description && <AppText variant="caption" color="muted">{definition.description}</AppText>}
            {definition.type === 'BOOLEAN' && (
              <ChoiceChips
                value={statuses[definition.id] === 'NOT_PLANNED' ? -2 : value ?? -1}
                onChange={next => updateValue(
                  definition.id,
                  next === -2 ? 0 : next,
                  next === -2 ? 'NOT_PLANNED' : 'RECORDED',
                )}
                options={[
                  { value: 1, label: 'Yes', color: booleanColor(definition, 1, colors) },
                  { value: -2, label: 'Not planned', color: colors.warning },
                  { value: 0, label: 'No', color: booleanColor(definition, 0, colors) },
                ]} />
            )}
            {definition.type === 'NUMBER' && (
              <AppInput
                label="Value"
                value={value === null || value === undefined ? '' : String(value)}
                onChangeText={text => updateValue(definition.id, text === '' ? null : Number(text))}
                keyboardType="decimal-pad" />
            )}
            {definition.type === 'RANGE' && (
              <AppSlider
                label={definition.name}
                value={value ?? min}
                minimumValue={min}
                maximumValue={max}
                minimumLabel={String(min)}
                maximumLabel={String(max)}
                onValueChange={next => updateValue(definition.id, next)}
                activeColor={colors.accent} />
            )}
            {definition.type === 'TIME' && (
              <TimeValueField value={value} onChange={next => updateValue(definition.id, next)} />
            )}
            {definition.type === 'DURATION' && (
              <DurationInput value={value ?? null} onChange={next => updateValue(definition.id, next)} />
            )}
            <AppButton
              label="Clear"
              variant="secondary"
              disabled={saving}
              onPress={() => updateValue(definition.id, null)}
            />
          </View>
        );
      })}
      {error && <AppText color="danger">{error}</AppText>}
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  definition: { gap: 8 },
  definitionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
});
