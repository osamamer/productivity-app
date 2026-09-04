import { Ionicons } from '@expo/vector-icons';
import { Href, router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/providers/ThemeProvider';
import { AppText } from './AppText';
import { SilentPressable } from './SilentPressable';

export function FeatureLinkCard({ title, description, icon, href }: {
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: Href;
}) {
  const { colors } = useAppTheme();
  return (
    <SilentPressable
      onPress={() => router.push(href)}
      style={({ pressed }) => [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && { opacity: 0.72 }]}>
      <View style={[styles.icon, { backgroundColor: colors.accentSoft }]}><Ionicons name={icon} size={24} color={colors.accent} /></View>
      <View style={styles.copy}>
        <AppText variant="heading">{title}</AppText>
        <AppText color="muted">{description}</AppText>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </SilentPressable>
  );
}

const styles = StyleSheet.create({
  card: { minHeight: 92, padding: 16, borderWidth: 1, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 14 },
  icon: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 3 },
});
