import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { StatComposerSheet } from '@/components/stats/StatComposerSheet';
import { StatEntrySheet } from '@/components/stats/StatEntrySheet';
import { StatHistoryPreview } from '@/components/stats/StatHistoryPreview';
import { AppButton } from '@/components/ui/AppButton';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { ChoiceChips } from '@/components/ui/ChoiceChips';
import { Screen } from '@/components/ui/Screen';
import { SilentPressable } from '@/components/ui/SilentPressable';
import { ErrorView, LoadingView } from '@/components/ui/StateView';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useAppTheme } from '@/providers/ThemeProvider';
import { api } from '@/services/api';
import type { StatDefinition, StatEntry, StatGroup } from '@/types/models';

interface StatsData { definitions: StatDefinition[]; entries: StatEntry[]; groups: StatGroup[] }

const AUTOMATIC_SYSTEM_KEYS = new Set(['meditated', 'meditation_minutes']);
const TIME_RANGES = [
  { value: 7, label: '7d' },
  { value: 30, label: '30d' },
  { value: 90, label: '3m' },
  { value: 365, label: '1y' },
];

function isManualDefinition(definition: StatDefinition): boolean {
  return !definition.systemKey || !AUTOMATIC_SYSTEM_KEYS.has(definition.systemKey);
}

export default function StatsScreen() {
  const { colors } = useAppTheme();
  const resource = useAsyncData<StatsData>(async () => {
    const [definitions, entries, groups] = await Promise.all([
      api.stats.definitions(),
      api.stats.today(),
      api.stats.groups(),
    ]);
    return { definitions: definitions.filter(isManualDefinition), entries, groups };
  });
  const [selected, setSelected] = useState<StatDefinition | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [dateRange, setDateRange] = useState(30);
  const entriesByDefinition = useMemo(() => new Map((resource.data?.entries ?? []).map(entry => [entry.statDefinitionId, entry])), [resource.data?.entries]);
  const groupedDefinitions = useMemo(() => (resource.data?.groups ?? [])
    .map(group => ({
      group,
      definitions: (resource.data?.definitions ?? []).filter(definition => group.statDefinitionIds.includes(definition.id)),
    }))
    .filter(item => item.definitions.length > 0), [resource.data?.definitions, resource.data?.groups]);
  const groupedDefinitionIds = useMemo(
    () => new Set(groupedDefinitions.flatMap(item => item.definitions.map(definition => definition.id))),
    [groupedDefinitions],
  );
  const ungroupedDefinitions = useMemo(
    () => (resource.data?.definitions ?? []).filter(definition => !groupedDefinitionIds.has(definition.id)),
    [groupedDefinitionIds, resource.data?.definitions],
  );

  async function refresh() {
    setHistoryRefreshKey(key => key + 1);
    await resource.reload();
  }

  function saveEntry(entry: StatEntry) {
    resource.setData(current => {
      if (!current) return current;
      const rest = current.entries.filter(item => item.statDefinitionId !== entry.statDefinitionId);
      return { ...current, entries: [...rest, entry] };
    });
  }

  function renderDefinition(definition: StatDefinition) {
    const entry = entriesByDefinition.get(definition.id);
    const icon = !entry
      ? 'add'
      : definition.type === 'BOOLEAN' && entry.value !== 1
        ? 'close'
        : 'checkmark';
    const iconColor = !entry
      ? colors.accent
      : definition.type === 'BOOLEAN' && entry.value !== 1
        ? colors.danger
        : colors.success;

    return (
      <SilentPressable key={definition.id} onPress={() => setSelected(definition)}>
        <Card style={styles.stat}>
          <StatHistoryPreview
            definition={definition}
            todayEntry={entry}
            dateRange={dateRange}
            refreshKey={historyRefreshKey}
            header={(
              <View style={styles.statHeader}>
                <View style={[styles.check, { backgroundColor: entry ? `${iconColor}20` : colors.accentSoft }]}>
                  <Ionicons name={icon} size={22} color={iconColor} />
                </View>
                <View style={styles.grow}><AppText variant="heading" numberOfLines={1}>{definition.name}</AppText></View>
              </View>
            )}
          />
        </Card>
      </SilentPressable>
    );
  }

  return (
    <Screen title="Statistics" action={<AppButton compact label="Stat" icon="add" onPress={() => setComposerOpen(true)} />} refreshing={resource.refreshing} onRefresh={() => void refresh()}>
      <View style={styles.timeframe} accessibilityLabel="Statistics time frame">
        <ChoiceChips value={dateRange} options={TIME_RANGES} onChange={setDateRange} />
      </View>
      {resource.loading && <LoadingView label="Loading statistics…" />}
      {resource.error && !resource.data && <ErrorView message={resource.error} retry={() => void resource.reload()} />}
      <View style={styles.list}>
        {groupedDefinitions.map(({ group, definitions }) => (
          <View key={group.groupId} style={styles.group}>
            <View style={styles.groupHeader}>
              <Ionicons name="folder-open-outline" size={17} color={colors.textMuted} />
              <AppText variant="label" style={styles.groupName}>{group.name}</AppText>
              <AppText variant="caption" color="muted">{definitions.length}</AppText>
            </View>
            <View style={styles.groupItems}>{definitions.map(renderDefinition)}</View>
          </View>
        ))}
        {ungroupedDefinitions.length > 0 && (
          <View style={styles.group}>
            {groupedDefinitions.length > 0 && (
              <View style={styles.groupHeader}>
                <Ionicons name="ellipsis-horizontal-circle-outline" size={17} color={colors.textMuted} />
                <AppText variant="label" style={styles.groupName}>Other stats</AppText>
                <AppText variant="caption" color="muted">{ungroupedDefinitions.length}</AppText>
              </View>
            )}
            <View style={styles.groupItems}>{ungroupedDefinitions.map(renderDefinition)}</View>
          </View>
        )}
      </View>
      <StatEntrySheet
        key={selected?.id ?? 'no-stat'}
        definition={selected}
        existing={selected ? entriesByDefinition.get(selected.id) : undefined}
        onClose={() => setSelected(null)}
        onSaved={saveEntry}
        onReverted={entry => resource.setData(current => {
          if (!current || !selected) return current;
          const rest = current.entries.filter(item => item.statDefinitionId !== selected.id);
          return { ...current, entries: entry ? [...rest, entry] : rest };
        })}
      />
      <StatComposerSheet visible={composerOpen} onClose={() => setComposerOpen(false)} onCreated={definition => resource.setData(current => current ? { ...current, definitions: [...current.definitions, definition] } : current)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  timeframe: { marginTop: -8, marginBottom: -4 },
  list: { gap: 16 },
  group: { gap: 8 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 3 },
  groupName: { flex: 1 },
  groupItems: { gap: 10 },
  stat: { padding: 14 },
  statHeader: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  check: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  grow: { flex: 1 },
});
