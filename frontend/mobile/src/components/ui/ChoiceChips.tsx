import { StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/providers/ThemeProvider';
import { AppText } from './AppText';
import { SilentPressable } from './SilentPressable';

interface Option<T extends string | number> {
  value: T;
  label: string;
  color?: string;
}

function readableTextColor(background: string, fallback: string): string {
  const match = /^#([\da-f]{6})$/i.exec(background);
  if (!match) return fallback;
  const linearize = (offset: number) => {
    const channel = Number.parseInt(match[1].slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  };
  const luminance = linearize(0) * 0.2126 + linearize(2) * 0.7152 + linearize(4) * 0.0722;
  return luminance > 0.179 ? '#1A1A1A' : '#FFFFFF';
}

export function ChoiceChips<T extends string | number>({ value, options, onChange, fillSelected = false }: {
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
  fillSelected?: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.row}>
      {options.map(option => {
        const selected = value === option.value;
        let textColor = option.color ?? colors.text;
        if (selected && fillSelected) {
          textColor = option.color ? readableTextColor(option.color, colors.onAccent) : colors.onAccent;
        } else if (selected) {
          textColor = option.color ?? colors.accent;
        }
        return (
          <SilentPressable
            key={String(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: selected && fillSelected ? option.color ?? colors.accent : 'transparent',
                borderColor: option.color ?? (selected ? colors.accent : colors.border),
              },
              pressed && { opacity: 0.72 },
            ]}>
            <AppText variant="caption" style={{ color: textColor }}>
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
