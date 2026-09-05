import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThreadComposerSheet } from '@/components/mind/ThreadComposerSheet';
import { ThreadDetailSheet } from '@/components/mind/ThreadDetailSheet';
import { AppButton } from '@/components/ui/AppButton';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { ChoiceChips } from '@/components/ui/ChoiceChips';
import { Screen } from '@/components/ui/Screen';
import { SilentPressable } from '@/components/ui/SilentPressable';
import { ErrorView, LoadingView } from '@/components/ui/StateView';
import { useAsyncData } from '@/hooks/useAsyncData';
import { usePreferences } from '@/providers/PreferencesProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { api } from '@/services/api';
import type { AttentionState, MentalThread, MentalThreadSummary } from '@/types/models';

interface ThreadData { threads: MentalThread[]; summary: MentalThreadSummary }
type StateFilter = AttentionState | 'ALL';

const closureLabels = {
  RESOLVED: 'Resolved',
  ACCEPTED: 'Accepted',
  RELEASED: 'Released',
} as const;

function stateLabel(state: AttentionState): string {
  return state[0] + state.slice(1).toLowerCase();
}

function stateColor(state: AttentionState, colors: ReturnType<typeof useAppTheme>['colors']): string {
  if (state === 'ACTING') return colors.accent;
  if (state === 'RUMINATING') return colors.danger;
  if (state === 'PLANNED') return colors.success;
  return colors.warning;
}

export default function MentalThreadsScreen() {
  const { colors } = useAppTheme();
  const { showClosedMentalThreads } = usePreferences();
  const resource = useAsyncData<ThreadData>(async () => {
    const [threads, summary] = await Promise.all([api.mentalThreads.all(true), api.mentalThreads.summary()]);
    return { threads, summary };
  });
  const [stateFilter, setStateFilter] = useState<StateFilter>('ALL');
  const [composerOpen, setComposerOpen] = useState(false);
  const [selected, setSelected] = useState<MentalThread | null>(null);
  const visible = useMemo(() => (resource.data?.threads ?? []).filter(thread => {
    if (!showClosedMentalThreads && thread.status === 'CLOSED') return false;
    return stateFilter === 'ALL' || thread.attentionState === stateFilter;
  }), [resource.data, showClosedMentalThreads, stateFilter]);

  const stateOptions = [
    { value: 'ALL' as const, label: 'All', color: colors.textMuted },
    { value: 'ACTING' as const, label: 'Acting', color: stateColor('ACTING', colors) },
    { value: 'RUMINATING' as const, label: 'Ruminating', color: stateColor('RUMINATING', colors) },
    { value: 'PLANNED' as const, label: 'Planned', color: stateColor('PLANNED', colors) },
    { value: 'PENDING' as const, label: 'Pending', color: stateColor('PENDING', colors) },
  ];

  const selectedVisible = selected && visible.some(thread => thread.id === selected.id) ? selected : null;

  function replace(updated: MentalThread) {
    resource.setData(current => current ? { ...current, threads: current.threads.map(thread => thread.id === updated.id ? updated : thread) } : current);
    setSelected(updated);
    void resource.reload();
  }

  return (
    <Screen
      refreshing={resource.refreshing}
      onRefresh={() => void resource.reload()}
      overlay={<AppButton label="Capture" icon="add" onPress={() => setComposerOpen(true)} style={styles.capture} />}>
      {resource.loading && <LoadingView />}
      {resource.error && !resource.data && <ErrorView message={resource.error} retry={() => void resource.reload()} />}
      {resource.data && (
        <>
          <Card style={styles.summary}>
            <View style={styles.metrics}>
              <View style={styles.metric}><AppText variant="title" color="accent">{resource.data.summary.openThreadCount}</AppText><AppText variant="caption" color="muted">OPEN</AppText></View>
              <View style={styles.metric}><AppText variant="title">{resource.data.summary.totalLoad}</AppText><AppText variant="caption" color="muted">TOTAL</AppText></View>
              <View style={styles.metric}><AppText variant="title" color={resource.data.summary.highLoadCount ? 'danger' : 'default'}>{resource.data.summary.highLoadCount}</AppText><AppText variant="caption" color="muted">HIGH</AppText></View>
            </View>
          </Card>
          <ChoiceChips value={stateFilter} onChange={setStateFilter} options={stateOptions} />
          <View style={styles.list}>
            {visible.map(thread => {
              const isResolved = thread.status === 'CLOSED' && thread.closureType === 'RESOLVED';
              const loadColor = isResolved ? colors.success : stateColor(thread.attentionState, colors);
              const label = thread.status === 'CLOSED' && thread.closureType
                ? closureLabels[thread.closureType]
                : stateLabel(thread.attentionState);
              return (
                <SilentPressable key={thread.id} onPress={() => setSelected(thread)}>
                  <Card style={styles.thread}>
                    <View style={styles.threadHeader}>
                      <AppText variant="heading" numberOfLines={2} style={styles.grow}>{thread.title}</AppText>
                      <View style={[styles.stateChip, { backgroundColor: `${loadColor}18`, borderColor: loadColor }]}>
                        <AppText variant="caption" style={{ color: loadColor }}>{label}</AppText>
                      </View>
                    </View>
                    <View accessibilityLabel={`Mental load ${thread.currentMentalLoad} out of 10`} style={[styles.loadTrack, { backgroundColor: colors.border }]}>
                      <View style={[styles.loadBar, { width: `${thread.currentMentalLoad * 10}%`, backgroundColor: loadColor }]} />
                    </View>
                  </Card>
                </SilentPressable>
              );
            })}
          </View>
        </>
      )}
      <ThreadComposerSheet visible={composerOpen} onClose={() => setComposerOpen(false)} onCreated={thread => { resource.setData(current => current ? { ...current, threads: [thread, ...current.threads] } : current); void resource.reload(); }} />
      <ThreadDetailSheet key={selectedVisible?.id ?? 'no-thread'} thread={selectedVisible} onClose={() => setSelected(null)} onUpdated={replace} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: { gap: 16 }, metrics: { flexDirection: 'row', justifyContent: 'space-between' },
  metric: { alignItems: 'center', gap: 2 }, list: { gap: 10 },
  thread: { gap: 12 }, threadHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stateChip: { minHeight: 28, paddingHorizontal: 10, borderRadius: 14, borderWidth: 1, justifyContent: 'center' },
  loadTrack: { height: 6, borderRadius: 3, overflow: 'hidden' }, loadBar: { height: '100%', borderRadius: 3 },
  capture: { position: 'absolute', right: 18, bottom: 24, minHeight: 52, borderRadius: 26, paddingHorizontal: 17, shadowColor: '#11111A', shadowOffset: { width: 0, height: 5 }, shadowRadius: 12, shadowOpacity: 0.28, elevation: 6 },
  grow: { flex: 1, gap: 3 },
});
