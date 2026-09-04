import { ComponentProps, forwardRef } from 'react';
import { StyleProp, StyleSheet, TextInput, View, ViewStyle } from 'react-native';

import { useAppTheme } from '@/providers/ThemeProvider';
import { APP_FONT_FAMILY, AppText } from './AppText';
import { useKeyboardAwareFocus } from './KeyboardAwareScrollView';

interface Props extends ComponentProps<typeof TextInput> {
  label?: string;
  error?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

export const AppInput = forwardRef<TextInput, Props>(function AppInput({ label, error, containerStyle, style, multiline, ...props }, ref) {
  const { colors } = useAppTheme();
  const focusInput = useKeyboardAwareFocus();
  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label && <AppText variant="caption" color="muted">{label}</AppText>}
      <TextInput
        ref={ref}
        {...props}
        autoCorrect={props.autoCorrect ?? false}
        spellCheck={props.spellCheck ?? false}
        multiline={multiline}
        onFocus={event => {
          focusInput?.(event.nativeEvent.target);
          props.onFocus?.(event);
        }}
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
});

AppInput.displayName = 'AppInput';

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
