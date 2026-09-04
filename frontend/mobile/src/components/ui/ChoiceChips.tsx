import { StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/providers/ThemeProvider';
import { AppText } from './AppText';
import { SilentPressable } from './SilentPressable';

interface Option<T extends string | number> {
  value: T;
  label: string;
  color?: string;
}

export function ChoiceChips<T extends string | number>({ value, options, onChange }: {
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.row}>
      {options.map(option => {
        const selected = value === option.value;
        return (
          <SilentPressable
            key={String(option.value)}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: selected ? option.color ?? colors.accent : colors.background,
                borderColor: option.color ?? (selected ? colors.accent : colors.border),
              },
              pressed && { opacity: 0.72 },
            ]}>
            <AppText variant="caption" style={{ color: selected ? colors.onAccent : option.color ?? colors.text }}>
              {option.label}
            </AppText>
          </SilentPressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, justifyContent: 'center' },
});
