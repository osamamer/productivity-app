import { Pressable, StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/providers/ThemeProvider';
import { AppText } from './AppText';

interface Option<T extends string | number> {
  value: T;
  label: string;
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
          <Pressable
            key={String(option.value)}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.chip,
              { backgroundColor: selected ? colors.accent : colors.background, borderColor: selected ? colors.accent : colors.border },
              pressed && { opacity: 0.72 },
            ]}>
            <AppText variant="caption" style={{ color: selected ? colors.onAccent : colors.text }}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, justifyContent: 'center' },
});
