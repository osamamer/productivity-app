import { Ionicons } from '@expo/vector-icons';
import { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';

import { useAppTheme } from '@/providers/ThemeProvider';
import { AppText } from './AppText';

interface Props {
  label: string;
  onPress: () => void;
  icon?: ComponentProps<typeof Ionicons>['name'];
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
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
  const { colors } = useAppTheme();
  const primary = variant === 'primary';
  const danger = variant === 'danger';
  const backgroundColor = primary
    ? colors.accent
    : danger
      ? `${colors.danger}18`
      : variant === 'secondary'
        ? colors.accentSoft
        : 'transparent';
  const foreground = primary ? colors.onAccent : danger ? colors.danger : colors.accent;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.compact,
        { backgroundColor, borderColor: primary ? colors.accent : colors.border },
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
    </Pressable>
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
