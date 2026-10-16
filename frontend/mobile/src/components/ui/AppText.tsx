import { ComponentProps } from 'react';
import { StyleSheet, Text, TextStyle } from 'react-native';

import { useAppTheme } from '@/providers/ThemeProvider';

type Variant = 'display' | 'title' | 'heading' | 'body' | 'label' | 'caption';

export const APP_FONT_FAMILY = 'InterRegular';
export const APP_FONT_SEMIBOLD = 'InterSemiBold';

const variantFontFamily: Record<Variant, string> = {
  display: APP_FONT_SEMIBOLD,
  title: APP_FONT_SEMIBOLD,
  heading: APP_FONT_SEMIBOLD,
  body: APP_FONT_FAMILY,
  label: APP_FONT_SEMIBOLD,
  caption: APP_FONT_FAMILY,
};

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

  return <Text {...props} style={[styles.base, { fontFamily: variantFontFamily[variant] }, styles[variant], { color: colorValue }, style]} />;
}

const styles = StyleSheet.create<Record<'base' | Variant, TextStyle>>({
  base: {},
  display: { fontSize: 32, lineHeight: 38, letterSpacing: -0.5 },
  title: { fontSize: 26, lineHeight: 32, letterSpacing: -0.3 },
  heading: { fontSize: 18, lineHeight: 24 },
  body: { fontSize: 15, lineHeight: 21 },
  label: { fontSize: 14, lineHeight: 18 },
  caption: { fontSize: 12, lineHeight: 16 },
});
