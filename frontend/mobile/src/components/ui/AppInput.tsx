import { ComponentProps } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { useAppTheme } from '@/providers/ThemeProvider';
import { APP_FONT_FAMILY, AppText } from './AppText';

interface Props extends ComponentProps<typeof TextInput> {
  label?: string;
  error?: string;
}

export function AppInput({ label, error, style, multiline, ...props }: Props) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.wrapper}>
      {label && <AppText variant="caption" color="muted">{label}</AppText>}
      <TextInput
        {...props}
        multiline={multiline}
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.accent}
        style={[
          styles.input,
          multiline && styles.multiline,
          { color: colors.text, backgroundColor: colors.background, borderColor: error ? colors.danger : colors.border },
          style,
        ]}
      />
      {error && <AppText variant="caption" color="danger">{error}</AppText>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 6 },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontFamily: APP_FONT_FAMILY,
    fontSize: 15,
    fontWeight: '500',
  },
  multiline: { minHeight: 104, textAlignVertical: 'top' },
});
