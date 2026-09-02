import { ComponentProps } from 'react';
import { Platform, StyleSheet, Text, TextStyle } from 'react-native';

import { useAppTheme } from '@/providers/ThemeProvider';

type Variant = 'display' | 'title' | 'heading' | 'body' | 'label' | 'caption';

export const APP_FONT_FAMILY = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: 'sans-serif',
}) ?? 'sans-serif';

interface Props extends ComponentProps<typeof Text> {
  variant?: Variant;
  color?: 'default' | 'muted' | 'accent' | 'danger' | 'success';
}

export function AppText({ variant = 'body', color = 'default', style, ...props }: Props) {
  const { colors } = useAppTheme();
  const colorValue = {
    default: colors.text,
    muted: colors.textMuted,
    accent: colors.accent,
    danger: colors.danger,
    success: colors.success,
  }[color];

  return <Text {...props} style={[styles.base, styles[variant], { color: colorValue }, style]} />;
}

const styles = StyleSheet.create<Record<'base' | Variant, TextStyle>>({
  base: { fontFamily: APP_FONT_FAMILY },
  display: { fontSize: 32, lineHeight: 38, fontWeight: '800', letterSpacing: -0.5 },
  title: { fontSize: 26, lineHeight: 32, fontWeight: '700', letterSpacing: -0.3 },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 21, fontWeight: '400' },
  label: { fontSize: 14, lineHeight: 18, fontWeight: '500' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
});
