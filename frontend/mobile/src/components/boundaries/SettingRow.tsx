import { Ionicons } from '@expo/vector-icons';
import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { SilentPressable } from '@/components/ui/SilentPressable';
import { useAppTheme } from '@/providers/ThemeProvider';

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  tone?: 'default' | 'good' | 'attention';
  onPress?: () => void;
  trailing?: ReactNode;
}

/** One line of the Boundaries home: an icon, a title with status, and an action or chevron. */
export function SettingRow({ icon, title, subtitle, tone = 'default', onPress, trailing }: Props) {
  const { colors } = useAppTheme();
  const iconColor = tone === 'good' ? colors.success : tone === 'attention' ? colors.warning : colors.accent;
  const body = (
    <>
      <View style={[styles.icon, { backgroundColor: `${iconColor}1F` }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <View style={styles.copy}>
        <AppText variant="label">{title}</AppText>
        {subtitle ? <AppText variant="caption" color="muted">{subtitle}</AppText> : null}
      </View>
      {trailing ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={colors.textMuted} /> : null)}
    </>
  );
  const style = [styles.row, { backgroundColor: colors.surface, borderColor: colors.border }];
  if (!onPress) return <View style={style}>{body}</View>;
  return (
    <SilentPressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [...style, pressed && { opacity: 0.72 }]}>
      {body}
    </SilentPressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 18, borderWidth: 1 },
  icon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 2 },
});
