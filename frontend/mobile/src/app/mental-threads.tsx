import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThreadCard } from '@/components/mind/ThreadCard';
import { threadStateColors } from '@/lib/mentalThreadPresentation';
import { ThreadComposerSheet } from '@/components/mind/ThreadComposerSheet';
import { ThreadDetailSheet } from '@/components/mind/ThreadDetailSheet';
import { AppButton } from '@/components/ui/AppButton';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { ChoiceChips } from '@/components/ui/ChoiceChips';
import { Screen } from '@/components/ui/Screen';
import { ErrorView, LoadingView } from '@/components/ui/StateView';
import { loadMentalThreads } from '@/services/pageResources';
import { useAsyncData } from '@/hooks/useAsyncData';
import { usePreferences } from '@/providers/PreferencesProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import type { AttentionState, MentalThread, MentalThreadSummary } from '@/types/models';

interface ThreadData { threads: MentalThread[]; summary: MentalThreadSummary }
type StateFilter = AttentionState | 'ALL';

export default function MentalThreadsScreen() {
  const { colors } = useAppTheme();
  const { showClosedMentalThreads } = usePreferences();
  const resource = useAsyncData<ThreadData>(loadMentalThreads, 'mental-threads');
  const [stateFilter, setStateFilter] = useState<StateFilter>('ALL');
  const [composerOpen, setComposerOpen] = useState(false);
  const [selected, setSelected] = useState<MentalThread | null>(null);
  const visible = useMemo(() => (resource.data?.threads ?? []).filter(thread => {
    if (!showClosedMentalThreads && thread.status === 'CLOSED') return false;
    return stateFilter === 'ALL' || thread.attentionState === stateFilter;
  }), [resource.data, showClosedMentalThreads, stateFilter]);

  const stateOptions = [
    { value: 'ALL' as const, label: 'All', color: colors.textMuted },
    { value: 'ACTING' as const, label: 'Acting', color: threadStateColors.ACTING },
    { value: 'RUMINATING' as const, label: 'Ruminating', color: threadStateColors.RUMINATING },
    { value: 'PLANNED' as const, label: 'Planned', color: threadStateColors.PLANNED },
    { value: 'PENDING' as const, label: 'Pending', color: threadStateColors.PENDING },
  ];

  const selectedVisible = selected && visible.some(thread => thread.id === selected.id) ? selected : null;

  function replace(updated: MentalThread) {
    resource.setData(current => current ? { ...current, threads: current.threads.map(thread => thread.id === updated.id ? updated : thread) } : current);
    setSelected(updated);
    void resource.reload();
  }

  return (
    <Screen
      back
      refreshing={resource.refreshing}
      onRefresh={() => void resource.reload()}
      overlay={<AppButton label="Capture" icon="add" onPress={() => setComposerOpen(true)} style={[styles.capture, { backgroundColor: colors.surface }]} />}>
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
            {visible.map(thread => <ThreadCard key={thread.id} thread={thread} onPress={() => setSelected(thread)} />)}
            {!visible.length && <AppText color="muted">No threads here. Capture something on your mind when you need to.</AppText>}
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
  capture: { position: 'absolute', right: 18, bottom: 32, zIndex: 1 },
});
