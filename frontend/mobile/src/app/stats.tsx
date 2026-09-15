import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { StatComposerSheet } from '@/components/stats/StatComposerSheet';
import { StatEntrySheet } from '@/components/stats/StatEntrySheet';
import { StatGroupComposerSheet } from '@/components/stats/StatGroupComposerSheet';
import { StatHistoryPreview } from '@/components/stats/StatHistoryPreview';
import { AppButton } from '@/components/ui/AppButton';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { ChoiceChips } from '@/components/ui/ChoiceChips';
import { Screen } from '@/components/ui/Screen';
import { SilentPressable } from '@/components/ui/SilentPressable';
import { ErrorView, LoadingView } from '@/components/ui/StateView';
import { useAsyncData } from '@/hooks/useAsyncData';
import { statGroupPreferencesStorageKey, readOpenStatGroupIds, writeOpenStatGroupIds } from '@/lib/statGroupPreferences';
import { subscribeToResourceInvalidation } from '@/lib/resourceInvalidation';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useAppPopup } from '@/providers/PopupProvider';
import { useAuth } from '@/providers/AuthProvider';
import { api } from '@/services/api';
import { reportError } from '@/lib/errors';
import { localDate } from '@/lib/date';
import { registerStatDefinitions } from '@/lib/optimisticStats';
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
  const { confirm, showError } = useAppPopup();
  const { user } = useAuth();
  const groupPreferencesKey = statGroupPreferencesStorageKey(user?.id);
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
  const [editingDefinition, setEditingDefinition] = useState<StatDefinition | null>(null);
  const [groupComposerOpen, setGroupComposerOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<StatGroup | null>(null);
  const [openGroupIds, setOpenGroupIds] = useState<Set<string>>(new Set());
  const [loadedGroupPreferencesKey, setLoadedGroupPreferencesKey] = useState<string | null>(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [dateRange, setDateRange] = useState(7);
  const { reload } = resource;

  useEffect(() => {
    let active = true;
    void readOpenStatGroupIds(groupPreferencesKey).then(ids => {
      if (!active) return;
      setOpenGroupIds(ids);
      setLoadedGroupPreferencesKey(groupPreferencesKey);
    });
    return () => { active = false; };
  }, [groupPreferencesKey]);

  useEffect(() => {
    if (loadedGroupPreferencesKey !== groupPreferencesKey) return;
    void writeOpenStatGroupIds(groupPreferencesKey, openGroupIds);
  }, [groupPreferencesKey, loadedGroupPreferencesKey, openGroupIds]);
  const entriesByDefinition = useMemo(() => new Map((resource.data?.entries ?? []).map(entry => [entry.statDefinitionId, entry])), [resource.data?.entries]);
  const groupedDefinitions = useMemo(() => (resource.data?.groups ?? [])
    .map(group => ({
      group,
      definitions: (resource.data?.definitions ?? []).filter(definition => group.statDefinitionIds.includes(definition.id)),
    })), [resource.data?.definitions, resource.data?.groups]);
  const groupedDefinitionIds = useMemo(
    () => new Set(groupedDefinitions.flatMap(item => item.definitions.map(definition => definition.id))),
    [groupedDefinitions],
  );
  const ungroupedDefinitions = useMemo(
    () => (resource.data?.definitions ?? []).filter(definition => !groupedDefinitionIds.has(definition.id)),
    [groupedDefinitionIds, resource.data?.definitions],
  );
  const groupPreferencesReady = loadedGroupPreferencesKey === groupPreferencesKey;

  const refresh = useCallback(async () => {
    setHistoryRefreshKey(key => key + 1);
    await reload();
  }, [reload]);

  useEffect(() => subscribeToResourceInvalidation('stats', () => {
    void refresh();
  }), [refresh]);

  useEffect(() => {
    registerStatDefinitions(resource.data?.definitions ?? []);
  }, [resource.data?.definitions]);

  function saveEntry(entry: StatEntry | null, date?: string) {
    if (!entry) {
      if (date !== localDate()) {
        void refresh();
        return;
      }
      resource.setData(current => current
        ? { ...current, entries: current.entries.filter(item => item.statDefinitionId !== selected?.id) }
        : current);
      return;
    }
    if (entry.date !== localDate()) {
      if (!entry.id.startsWith('optimistic-')) void refresh();
      return;
    }
    resource.setData(current => {
      if (!current) return current;
      const rest = current.entries.filter(item => item.statDefinitionId !== entry.statDefinitionId);
      return { ...current, entries: [...rest, entry] };
    });
  }

  function openCreateGroup() {
    setEditingGroup(null);
    setGroupComposerOpen(true);
  }

  function openCreateStat() {
    setEditingDefinition(null);
    setComposerOpen(true);
  }

  function openEditStat(definition: StatDefinition) {
    setEditingDefinition(definition);
    setComposerOpen(true);
  }

  function closeStatComposer() {
    setComposerOpen(false);
    setEditingDefinition(null);
  }

  function saveDefinition(updatedDefinition: StatDefinition) {
    resource.setData(current => current
      ? { ...current, definitions: current.definitions.map(definition => definition.id === updatedDefinition.id ? updatedDefinition : definition) }
      : current);
  }

  function openEditGroup(group: StatGroup) {
    setEditingGroup(group);
    setGroupComposerOpen(true);
  }

  function closeGroupComposer() {
    setGroupComposerOpen(false);
    setEditingGroup(null);
  }

  function saveGroup(updatedGroup: StatGroup) {
    resource.setData(current => {
      if (!current) return current;
      const selectedIdSet = new Set(updatedGroup.statDefinitionIds);
      const groups = current.groups.map(group => group.groupId === updatedGroup.groupId
        ? updatedGroup
        : { ...group, statDefinitionIds: group.statDefinitionIds.filter(id => !selectedIdSet.has(id)) });
      return current.groups.some(group => group.groupId === updatedGroup.groupId)
        ? { ...current, groups }
        : { ...current, groups: [...groups, updatedGroup] };
    });
  }

  async function deleteGroup(group: StatGroup) {
    const accepted = await confirm(
      `Delete ${group.name}?`,
      'The stats will stay intact and become ungrouped.',
      'Delete group',
    );
    if (!accepted) return;
    try {
      await api.stats.removeGroup(group.groupId);
      resource.setData(current => current
        ? { ...current, groups: current.groups.filter(item => item.groupId !== group.groupId) }
        : current);
      setOpenGroupIds(current => {
        const next = new Set(current);
        next.delete(group.groupId);
        return next;
      });
    } catch (cause) {
      await showError('Could not delete group', reportError('Could not delete stat group', cause));
    }
  }

  function toggleGroup(groupId: string) {
    setOpenGroupIds(current => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  function renderDefinition(definition: StatDefinition) {
    const entry = entriesByDefinition.get(definition.id);
    const icon = !entry
      ? 'add'
      : definition.type === 'BOOLEAN' && entry.status === 'NOT_PLANNED'
        ? 'remove-circle-outline'
      : definition.type === 'BOOLEAN' && entry.value !== 1
        ? 'close'
        : 'checkmark';
    const iconColor = !entry
      ? colors.accent
      : definition.type === 'BOOLEAN' && entry.status === 'NOT_PLANNED'
        ? colors.notPlanned
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
                <SilentPressable
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${definition.name}`}
                  hitSlop={8}
                  onPress={event => { event.stopPropagation(); openEditStat(definition); }}
                  style={({ pressed }) => [styles.iconAction, pressed && styles.pressed]}>
                  <Ionicons name="create-outline" size={18} color={colors.textMuted} />
                </SilentPressable>
              </View>
            )}
          />
        </Card>
      </SilentPressable>
    );
  }

  return (
    <Screen
      safeAreaTop={false}
      refreshing={resource.refreshing}
      onRefresh={() => void refresh()}>
      <View style={styles.controls} accessibilityLabel="Statistics controls">
        <ChoiceChips value={dateRange} options={TIME_RANGES} onChange={setDateRange} />
        <View style={styles.headerActions}>
          <AppButton compact variant="secondary" label="Group" icon="folder-open-outline" onPress={openCreateGroup} style={styles.compactAction} />
          <AppButton compact label="Stat" icon="add" onPress={openCreateStat} style={styles.compactAction} />
        </View>
      </View>
      {resource.loading && <LoadingView label="Loading statistics…" />}
      {resource.error && !resource.data && <ErrorView message={resource.error} retry={() => void resource.reload()} />}
      <View style={styles.list}>
        {groupedDefinitions.map(({ group, definitions }) => {
          const open = groupPreferencesReady && openGroupIds.has(group.groupId);
          return (
            <View key={group.groupId} style={styles.group}>
              <View style={styles.groupHeader}>
                <SilentPressable
                  accessibilityRole="button"
                  accessibilityLabel={`${open ? 'Collapse' : 'Expand'} ${group.name}`}
                  onPress={() => toggleGroup(group.groupId)}
                  style={({ pressed }) => [styles.groupHeaderMain, pressed && styles.pressed]}>
                  <Ionicons name={open ? 'chevron-down' : 'chevron-forward'} size={16} color={colors.textMuted} />
                  <Ionicons name="folder-open-outline" size={17} color={colors.textMuted} />
                  <AppText variant="label" style={styles.groupName} numberOfLines={1}>{group.name}</AppText>
                  <AppText variant="caption" color="muted">{definitions.length}</AppText>
                </SilentPressable>
                <View style={styles.groupActions}>
                  <SilentPressable
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${group.name}`}
                    hitSlop={8}
                    onPress={() => openEditGroup(group)}
                    style={({ pressed }) => [styles.iconAction, pressed && styles.pressed]}>
                    <Ionicons name="create-outline" size={18} color={colors.textMuted} />
                  </SilentPressable>
                  <SilentPressable
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${group.name}`}
                    hitSlop={8}
                    onPress={() => void deleteGroup(group)}
                    style={({ pressed }) => [styles.iconAction, pressed && styles.pressed]}>
                    <Ionicons name="trash-outline" size={18} color={colors.danger} />
                  </SilentPressable>
                </View>
              </View>
              {open && (
                definitions.length > 0
                  ? <View style={styles.groupItems}>{definitions.map(renderDefinition)}</View>
                  : <AppText variant="caption" color="muted" style={styles.emptyGroup}>No stats in this group yet.</AppText>
              )}
            </View>
          );
        })}
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
        onReverted={(entry, date) => resource.setData(current => {
          if (!current || !selected) return current;
          if (date !== localDate()) return current;
          const rest = current.entries.filter(item => item.statDefinitionId !== selected.id);
          return { ...current, entries: entry ? [...rest, entry] : rest };
        })}
      />
      <StatComposerSheet
        key={`stat-${editingDefinition?.id ?? 'new'}-${composerOpen ? 'open' : 'closed'}`}
        visible={composerOpen}
        definition={editingDefinition}
        onClose={closeStatComposer}
        onCreated={definition => resource.setData(current => current ? { ...current, definitions: [...current.definitions, definition] } : current)}
        onUpdated={definition => { saveDefinition(definition); closeStatComposer(); }}
      />
      <StatGroupComposerSheet
        key={`stat-group-${editingGroup?.groupId ?? 'new'}-${groupComposerOpen ? 'open' : 'closed'}`}
        visible={groupComposerOpen}
        group={editingGroup}
        definitions={resource.data?.definitions ?? []}
        onClose={closeGroupComposer}
        onSaved={saveGroup}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  controls: { gap: 10 },
  headerActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 6, flexWrap: 'wrap' },
  compactAction: { paddingHorizontal: 8, gap: 4, flexShrink: 1 },
  list: { gap: 16 },
  group: { gap: 8 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 3 },
  groupHeaderMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 36 },
  groupName: { flex: 1 },
  groupActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconAction: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  groupItems: { gap: 10 },
  emptyGroup: { paddingHorizontal: 12, paddingVertical: 12 },
  stat: { padding: 14 },
  statHeader: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  check: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  grow: { flex: 1 },
  pressed: { opacity: 0.72 },
});
