import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { ThreadComposerSheet } from '@/components/mind/ThreadComposerSheet';
import { ThreadDetailSheet } from '@/components/mind/ThreadDetailSheet';
import { AppButton } from '@/components/ui/AppButton';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { ChoiceChips } from '@/components/ui/ChoiceChips';
import { Screen } from '@/components/ui/Screen';
import { ErrorView, LoadingView } from '@/components/ui/StateView';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useAppTheme } from '@/providers/ThemeProvider';
import { api } from '@/services/api';
import type { MentalThread, MentalThreadSummary } from '@/types/models';

interface ThreadData { threads: MentalThread[]; summary: MentalThreadSummary }

export default function MentalThreadsScreen() {
  const { colors } = useAppTheme();
  const resource = useAsyncData<ThreadData>(async () => {
    const [threads, summary] = await Promise.all([api.mentalThreads.all(true), api.mentalThreads.summary()]);
    return { threads, summary };
  });
  const [show, setShow] = useState<'open' | 'closed'>('open');
  const [composerOpen, setComposerOpen] = useState(false);
  const [selected, setSelected] = useState<MentalThread | null>(null);
  const visible = useMemo(() => (resource.data?.threads ?? []).filter(thread => thread.status === (show === 'open' ? 'OPEN' : 'CLOSED')), [resource.data, show]);

  function replace(updated: MentalThread) {
    resource.setData(current => current ? { ...current, threads: current.threads.map(thread => thread.id === updated.id ? updated : thread) } : current);
    setSelected(updated);
    void resource.reload();
  }

  async function capacity(value: number) {
    if (!resource.data) return;
    const previous = resource.data.summary.capacityToday;
    resource.setData({ ...resource.data, summary: { ...resource.data.summary, capacityToday: value } });
    try { await api.mentalThreads.capacity(value); }
    catch (cause) {
      resource.setData(current => current ? { ...current, summary: { ...current.summary, capacityToday: previous } } : current);
      Alert.alert('Could not save capacity', cause instanceof Error ? cause.message : undefined);
    }
  }

  return (
    <Screen
      title="Mental threads"
      eyebrow="Name what is taking space"
      action={<AppButton compact label="Capture" icon="add" onPress={() => setComposerOpen(true)} />}
      refreshing={resource.refreshing}
      onRefresh={() => void resource.reload()}>
      {resource.loading && <LoadingView />}
      {resource.error && !resource.data && <ErrorView message={resource.error} retry={() => void resource.reload()} />}
      {resource.data && (
        <>
          <Card style={styles.summary}>
            <View style={styles.metrics}>
              <View style={styles.metric}><AppText variant="title" color="accent">{resource.data.summary.openThreadCount}</AppText><AppText variant="caption" color="muted">OPEN</AppText></View>
              <View style={styles.metric}><AppText variant="title">{resource.data.summary.totalLoad}</AppText><AppText variant="caption" color="muted">TOTAL LOAD</AppText></View>
              <View style={styles.metric}><AppText variant="title" color={resource.data.summary.highLoadCount ? 'danger' : 'default'}>{resource.data.summary.highLoadCount}</AppText><AppText variant="caption" color="muted">HIGH LOAD</AppText></View>
            </View>
            <AppText variant="label">Capacity today · {resource.data.summary.capacityToday ?? 'not checked in'}</AppText>
            <ChoiceChips value={resource.data.summary.capacityToday ?? 0} onChange={value => void capacity(value)} options={[1,2,3,4,5,6,7,8,9,10].map(value => ({ value, label: String(value) }))} />
          </Card>
          <ChoiceChips value={show} onChange={setShow} options={[{ value: 'open', label: 'Open' }, { value: 'closed', label: 'Closed' }]} />
          <View style={styles.list}>
            {visible.map(thread => {
              const loadColor = thread.currentMentalLoad >= 8 ? colors.high : thread.currentMentalLoad >= 5 ? colors.medium : colors.low;
              return (
                <Pressable key={thread.id} onPress={() => setSelected(thread)}>
                  <Card style={styles.thread}>
                    <View style={[styles.load, { backgroundColor: loadColor }]}><AppText variant="label" style={{ color: '#1A1A2E' }}>{thread.currentMentalLoad}</AppText></View>
                    <View style={styles.grow}>
                      <AppText variant="heading">{thread.title}</AppText>
                      <AppText variant="caption" color="muted">{thread.attentionState.toLowerCase()} · {thread.status.toLowerCase()}</AppText>
                      {thread.desiredResolution && <AppText color="muted" numberOfLines={2}>{thread.desiredResolution}</AppText>}
                    </View>
                  </Card>
                </Pressable>
              );
            })}
          </View>
        </>
      )}
      <ThreadComposerSheet visible={composerOpen} onClose={() => setComposerOpen(false)} onCreated={thread => { resource.setData(current => current ? { ...current, threads: [thread, ...current.threads] } : current); void resource.reload(); }} />
      <ThreadDetailSheet key={selected?.id ?? 'no-thread'} thread={selected} onClose={() => setSelected(null)} onUpdated={replace} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: { gap: 16 }, metrics: { flexDirection: 'row', justifyContent: 'space-between' },
  metric: { alignItems: 'center', gap: 2 }, list: { gap: 10 },
  thread: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  load: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  grow: { flex: 1, gap: 3 },
});
