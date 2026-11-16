import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';

import { AppInput } from '@/components/ui/AppInput';
import { AppText } from '@/components/ui/AppText';
import { Screen } from '@/components/ui/Screen';
import { SilentPressable } from '@/components/ui/SilentPressable';
import { rememberInstalledApps } from '@/lib/boundaryAppsCache';
import { type AppRule, type AppUsage, summarizeRule, summarizeUsage } from '@/lib/boundaryRules';
import { useAppTheme } from '@/providers/ThemeProvider';
import { Boundaries, type InstalledApp } from '@/services/boundaries';

interface Loaded {
  apps: InstalledApp[];
  rules: Record<string, AppRule>;
  usage: Record<string, AppUsage>;
}

async function load(): Promise<Loaded> {
  if (!Boundaries) return { apps: [], rules: {}, usage: {} };
  const [apps, rulesJson, usageJson] = await Promise.all([
    Boundaries.getInstalledApps(),
    Boundaries.getRules(),
    Boundaries.getUsageToday(),
  ]);
  const rules: Record<string, AppRule> = {};
  for (const rule of JSON.parse(rulesJson) as AppRule[]) rules[rule.pkg] = rule;
  // Apps with rules first, then alphabetical.
  apps.sort((a, b) => Number(!rules[a.packageName]) - Number(!rules[b.packageName]) || a.appName.localeCompare(b.appName));
  rememberInstalledApps(apps);
  return { apps, rules, usage: JSON.parse(usageJson) as Record<string, AppUsage> };
}

export default function BoundaryApps() {
  const { colors } = useAppTheme();
  const [data, setData] = useState<Loaded | null>(null);
  const [query, setQuery] = useState('');

  useFocusEffect(useCallback(() => {
    load().then(setData).catch(cause => console.error('Could not load installed apps:', cause));
  }, []));

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!data) return [];
    if (!needle) return data.apps;
    return data.apps.filter(app => app.appName.toLowerCase().includes(needle) || app.packageName.toLowerCase().includes(needle));
  }, [data, query]);

  const ruleCount = data ? Object.keys(data.rules).length : 0;

  return (
    <Screen back>
      <AppText variant="display">App rules</AppText>
      <AppInput value={query} onChangeText={setQuery} placeholder="Search apps" />
      <AppText variant="caption" color="muted">
        {ruleCount} {ruleCount === 1 ? 'app has' : 'apps have'} a boundary · tap an app to block, limit or schedule it
      </AppText>
      {!data ? (
        <ActivityIndicator color={colors.accent} style={styles.loading} />
      ) : (
        <View style={[styles.list, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {visible.map((app, index) => {
            const rule = data.rules[app.packageName];
            const usageLine = rule ? summarizeUsage(rule, data.usage[app.packageName]) : null;
            return (
              <SilentPressable
                key={app.packageName}
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/boundaries/[pkg]', params: { pkg: app.packageName } })}
                style={({ pressed }) => [
                  styles.row,
                  index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                  pressed && { opacity: 0.72 },
                ]}>
                {app.icon
                  ? <Image source={{ uri: `data:image/png;base64,${app.icon}` }} style={styles.icon} />
                  : <View style={[styles.icon, { backgroundColor: colors.surfaceRaised }]} />}
                <View style={styles.copy}>
                  <AppText variant="label" numberOfLines={1}>{app.appName}</AppText>
                  {rule ? (
                    <>
                      <AppText variant="caption" color="accent" numberOfLines={2}>{summarizeRule(rule)}</AppText>
                      {usageLine ? <AppText variant="caption" color="muted">{usageLine}</AppText> : null}
                    </>
                  ) : (
                    <AppText variant="caption" color="muted" numberOfLines={1}>{app.packageName}</AppText>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </SilentPressable>
            );
          })}
          {!visible.length && <AppText color="muted" style={styles.empty}>No apps match.</AppText>}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { marginTop: 40 },
  list: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  icon: { width: 40, height: 40, borderRadius: 11 },
  copy: { flex: 1, gap: 2 },
  empty: { padding: 16 },
});
