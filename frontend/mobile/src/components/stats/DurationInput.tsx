import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { minutesToDurationParts } from '@/lib/statValues';
import { AppInput } from '../ui/AppInput';

export function DurationInput({ value, onChange, autoFocus = false }: {
  value: number | null;
  onChange: (value: number | null) => void;
  autoFocus?: boolean;
}) {
  const initialParts = minutesToDurationParts(value);
  const [hours, setHours] = useState(initialParts.hours);
  const [minutes, setMinutes] = useState(initialParts.minutes);
  const lastEmittedValue = useRef<number | null>(value);

  useEffect(() => {
    if (value === lastEmittedValue.current) return;
    lastEmittedValue.current = value;
    const parts = minutesToDurationParts(value);
    setHours(parts.hours);
    setMinutes(parts.minutes);
  }, [value]);

  function updateValue(nextHours: string, nextMinutes: string) {
    setHours(nextHours);
    setMinutes(nextMinutes);
    if (nextHours === '' || nextMinutes === '') {
      lastEmittedValue.current = null;
      onChange(null);
      return;
    }

    const parsedHours = Number(nextHours);
    const parsedMinutes = Number(nextMinutes);
    const nextValue = Number.isSafeInteger(parsedHours) && parsedHours >= 0
      && Number.isSafeInteger(parsedMinutes) && parsedMinutes >= 0 && parsedMinutes < 60
      ? parsedHours * 60 + parsedMinutes
      : null;
    lastEmittedValue.current = nextValue;
    onChange(nextValue);
  }

  return (
    <View style={styles.row}>
      <AppInput
        containerStyle={styles.field}
        label="Hours"
        value={hours}
        onChangeText={next => updateValue(next, minutes)}
        keyboardType="number-pad"
        autoFocus={autoFocus}
      />
      <AppInput
        containerStyle={styles.field}
        label="Minutes"
        value={minutes}
        onChangeText={next => updateValue(hours, next)}
        keyboardType="number-pad"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  field: { flex: 1 },
});
