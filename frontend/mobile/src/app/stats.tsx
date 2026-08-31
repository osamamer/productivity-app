import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { StatComposerSheet } from '@/components/stats/StatComposerSheet';
import { StatEntrySheet } from '@/components/stats/StatEntrySheet';
import { AppButton } from '@/components/ui/AppButton';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { ErrorView, LoadingView } from '@/components/ui/StateView';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useAppTheme } from '@/providers/ThemeProvider';
import { api } from '@/services/api';
import type { StatDefinition, StatEntry } from '@/types/models';

interface StatsData { definitions: StatDefinition[]; entries: StatEntry[] }

export default function StatsScreen() {
  const { colors } = useAppTheme();
  const resource = useAsyncData<StatsData>(async () => {
    const [definitions, entries] = await Promise.all([api.stats.definitions(), api.stats.today()]);
    return { definitions, entries };
  });
  const [selected, setSelected] = useState<StatDefinition | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const entriesByDefinition = useMemo(() => new Map((resource.data?.entries ?? []).map(entry => [entry.statDefinitionId, entry])), [resource.data?.entries]);
  const completed = resource.data?.definitions.filter(def => entriesByDefinition.has(def.id)).length ?? 0;

  function saveEntry(entry: StatEntry) {
    resource.setData(current => {
      if (!current) return current;
      const rest = current.entries.filter(item => item.statDefinitionId !== entry.statDefinitionId);
      return { ...current, entries: [...rest, entry] };
    });
  }

  return (
    <Screen title="Statistics" eyebrow="Notice your patterns" action={<AppButton compact label="Stat" icon="add" onPress={() => setComposerOpen(true)} />} refreshing={resource.refreshing} onRefresh={() => void resource.reload()}>
      {resource.data && (
        <Card style={styles.summary}>
          <View><AppText variant="title">{completed}/{resource.data.definitions.length}</AppText><AppText color="muted">checked in today</AppText></View>
          <View style={[styles.summaryIcon, { backgroundColor: colors.accentSoft }]}><Ionicons name="analytics" size={28} color={colors.accent} /></View>
        </Card>
      )}
      {resource.loading && <LoadingView label="Loading statistics…" />}
      {resource.error && !resource.data && <ErrorView message={resource.error} retry={() => void resource.reload()} />}
      <View style={styles.list}>
        {(resource.data?.definitions ?? []).map(definition => {
          const entry = entriesByDefinition.get(definition.id);
          const display = !entry ? 'Not logged' : definition.type === 'BOOLEAN' ? (entry.value ? 'Yes' : 'No') : String(entry.value);
          return (
            <Pressable key={definition.id} onPress={() => setSelected(definition)}>
              <Card style={styles.stat}>
                <View style={[styles.check, { backgroundColor: entry ? `${colors.success}20` : colors.accentSoft }]}>
                  <Ionicons name={entry ? 'checkmark' : 'add'} size={22} color={entry ? colors.success : colors.accent} />
                </View>
                <View style={styles.grow}><AppText variant="heading">{definition.name}</AppText><AppText color="muted" numberOfLines={1}>{definition.description || definition.type.toLowerCase()}</AppText></View>
                <AppText variant="label" color={entry ? 'success' : 'muted'}>{display}</AppText>
              </Card>
            </Pressable>
          );
        })}
      </View>
      <StatEntrySheet key={selected?.id ?? 'no-stat'} definition={selected} existing={selected ? entriesByDefinition.get(selected.id) : undefined} onClose={() => setSelected(null)} onSaved={saveEntry} />
      <StatComposerSheet visible={composerOpen} onClose={() => setComposerOpen(false)} onCreated={definition => resource.setData(current => current ? { ...current, definitions: [...current.definitions, definition] } : current)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, summaryIcon: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  list: { gap: 10 }, stat: { flexDirection: 'row', alignItems: 'center', gap: 13 }, check: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, grow: { flex: 1, gap: 2 },
});
