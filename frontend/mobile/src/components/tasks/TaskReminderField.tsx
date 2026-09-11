import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppInput } from '../ui/AppInput';
import { AppText } from '../ui/AppText';
import { ChoiceChips } from '../ui/ChoiceChips';

const PRESET_REMINDER_OPTIONS = [
  { value: 60, label: '1 hour before' },
  { value: 1440, label: '1 day before' },
] as const;

type ReminderChoice = 'none' | 'custom' | 60 | 1440;

function isPreset(value: number | null | undefined): value is 60 | 1440 {
  return value === 60 || value === 1440;
}

export function TaskReminderField({ value, onChange }: {
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  const customValue = value != null && !isPreset(value);
  const [customOpen, setCustomOpen] = useState(customValue);
  const [customMinutes, setCustomMinutes] = useState(customValue ? String(value) : '30');

  const selectedChoice: ReminderChoice = customOpen || customValue
    ? 'custom'
    : isPreset(value) ? value : 'none';

  function choose(choice: ReminderChoice) {
    if (choice === 'custom') {
      const nextMinutes = customValue ? value! : 30;
      setCustomOpen(true);
      setCustomMinutes(String(nextMinutes));
      onChange(nextMinutes);
      return;
    }

    setCustomOpen(false);
    if (choice === 'none') return;
    onChange(choice);
  }

  function changeCustomMinutes(text: string) {
    const nextText = text.replace(/\D/g, '').slice(0, 5);
    setCustomMinutes(nextText);
    const nextMinutes = Number(nextText);
    onChange(nextText && Number.isSafeInteger(nextMinutes) ? nextMinutes : null);
  }

  return (
    <View style={styles.container}>
      <AppText variant="label">Remind me</AppText>
      <ChoiceChips
        value={selectedChoice}
        onChange={choose}
        options={[
          ...PRESET_REMINDER_OPTIONS,
          { value: 'custom' as const, label: 'Custom' },
        ]} />
      {customOpen && (
        <View style={styles.customRow}>
          <AppInput
            containerStyle={styles.customInput}
            label="Minutes before"
            value={customMinutes}
            onChangeText={changeCustomMinutes}
            keyboardType="number-pad"
            maxLength={5}
            placeholder="30"
          />
          <AppText variant="caption" color="muted" style={styles.unit}>minutes</AppText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  customRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  customInput: { flex: 1 },
  unit: { paddingBottom: 15 },
});
