import { Ionicons } from '@expo/vector-icons';
import { ComponentProps } from 'react';
import { ActivityIndicator, StyleProp, StyleSheet, ViewStyle } from 'react-native';

import { useAppTheme } from '@/providers/ThemeProvider';
import { AppText } from './AppText';
import { SilentPressable } from './SilentPressable';

interface Props {
  label: string;
  onPress: () => void;
  icon?: ComponentProps<typeof Ionicons>['name'];
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  disabled?: boolean;
  loading?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function AppButton({
  label,
  onPress,
  icon,
  variant = 'primary',
  disabled,
  loading,
  compact,
  style,
}: Props) {
  const { colors, dark } = useAppTheme();
  const primary = variant === 'primary';
  const danger = variant === 'danger';
  const success = variant === 'success';
  const backgroundColor = primary
    ? colors.accent
    : success
      ? colors.success
    : danger
      ? `${colors.danger}18`
      : variant === 'secondary'
        ? colors.accentSoft
        : 'transparent';
  const foreground = primary
    ? colors.onAccent
    : success
      ? dark ? colors.onAccent : colors.text
      : danger ? colors.danger : colors.accent;

  return (
    <SilentPressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.compact,
        { backgroundColor, borderColor: primary || success ? backgroundColor : colors.border },
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator size="small" color={foreground} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={compact ? 16 : 19} color={foreground} />}
          <AppText variant="label" style={{ color: foreground }}>{label}</AppText>
        </>
      )}
    </SilentPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  compact: { minHeight: 36, borderRadius: 11, paddingHorizontal: 12 },
  disabled: { opacity: 0.48 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.985 }] },
});
