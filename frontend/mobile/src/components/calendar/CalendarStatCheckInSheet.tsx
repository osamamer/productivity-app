import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { reportError } from '@/lib/errors';
import { useAppTheme } from '@/providers/ThemeProvider';
import { api } from '@/services/api';
import type { StatDefinition } from '@/types/models';
import { AppButton } from '../ui/AppButton';
import { AppInput } from '../ui/AppInput';
import { AppSlider } from '../ui/AppSlider';
import { AppText } from '../ui/AppText';
import { ChoiceChips } from '../ui/ChoiceChips';
import { ModalSheet } from '../ui/ModalSheet';

function booleanColor(definition: StatDefinition, value: 0 | 1, colors: ReturnType<typeof useAppTheme>['colors']): string {
  const morality = definition.morality ?? 'NEUTRAL';
  if (morality === 'NEUTRAL') return value === 1 ? colors.accent : colors.secondary;
  if (morality === 'GOOD') return value === 1 ? colors.success : colors.danger;
  return value === 1 ? colors.danger : colors.success;
}

function formatValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function CalendarStatCheckInSheet({ date, definitions, onClose, onSaved }: {
  date: string | null;
  definitions: StatDefinition[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { colors } = useAppTheme();
  const [values, setValues] = useState<Record<string, number | null>>({});
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
      .then(entries => {
        if (!active) return;
        const nextValues: Record<string, number | null> = {};
        const nextTouched = new Set<string>();
        definitions.forEach(definition => { nextValues[definition.id] = null; });
        entries.forEach(entry => {
          nextValues[entry.statDefinitionId] = entry.value;
          nextTouched.add(entry.statDefinitionId);
        });
        setValues(nextValues);
        setTouched(nextTouched);
      })
      .catch(cause => {
        if (active) setError(reportError('Could not load statistics', cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [date, definitions]);

  function updateValue(id: string, value: number | null) {
    setValues(previous => ({ ...previous, [id]: value }));
    setTouched(previous => {
      const next = new Set(previous);
      if (value === null) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    if (!date || saving || touched.size === 0) return;
    setSaving(true);
    setError(null);
    try {
      await Promise.all(definitions
        .filter(definition => touched.has(definition.id) && values[definition.id] !== null)
        .map(definition => api.stats.record(definition.id, values[definition.id]!, date)));
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
              {value !== null && value !== undefined && <AppText variant="caption" color="muted">{formatValue(value)}</AppText>}
            </View>
            {definition.description && <AppText variant="caption" color="muted">{definition.description}</AppText>}
            {definition.type === 'BOOLEAN' && (
              <ChoiceChips
                value={value ?? -1}
                onChange={next => updateValue(definition.id, next)}
                options={[
                  { value: 1, label: 'Yes', color: booleanColor(definition, 1, colors) },
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
