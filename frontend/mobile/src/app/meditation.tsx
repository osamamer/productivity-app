import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { ChoiceChips } from '@/components/ui/ChoiceChips';
import { Screen } from '@/components/ui/Screen';
import { ErrorView, LoadingView } from '@/components/ui/StateView';
import { useAsyncData } from '@/hooks/useAsyncData';
import { clock, secondsFromDuration } from '@/lib/date';
import { reportError } from '@/lib/errors';
import { useAppTheme } from '@/providers/ThemeProvider';
import { api } from '@/services/api';
import type { MeditationSession } from '@/types/models';

function elapsedSeconds(session: MeditationSession, now: number): number {
  const saved = secondsFromDuration(session.totalSessionTime);
  if (!session.running || !session.lastUnpauseTime) return saved;
  const runningSince = new Date(session.lastUnpauseTime).getTime();
  return saved + Math.max(0, (now - runningSince) / 1000);
}

export default function MeditationScreen() {
  const { colors } = useAppTheme();
  const resource = useAsyncData(async () => (await api.meditation.active()) ?? null);
  const [duration, setDuration] = useState(10);
  const [moodBefore, setMoodBefore] = useState(5);
  const [moodAfter, setMoodAfter] = useState(5);
  const [now, setNow] = useState(() => Date.now());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const session = resource.data;
  const elapsed = session ? elapsedSeconds(session, now) : 0;
  const remaining = session ? Math.max(0, session.intendedLength - elapsed) : duration * 60;
  const progress = session?.intendedLength ? Math.min(1, elapsed / session.intendedLength) : 0;

  async function start() {
    setSaving(true); setError(null);
    try { resource.setData(await api.meditation.start(moodBefore, duration * 60)); }
    catch (cause) { setError(reportError('Could not start meditation', cause)); }
    finally { setSaving(false); }
  }

  async function toggle() {
    if (!session) return;
    setSaving(true); setError(null);
    try { resource.setData(session.running ? await api.meditation.pause(session.id) : await api.meditation.resume(session.id)); }
    catch (cause) { setError(reportError('Could not update meditation', cause)); }
    finally { setSaving(false); }
  }

  async function finish() {
    if (!session) return;
    setSaving(true); setError(null);
    try { await api.meditation.end(session.id, moodAfter); resource.setData(null); }
    catch (cause) { setError(reportError('Could not finish meditation', cause)); }
    finally { setSaving(false); }
  }

  const ring = useMemo(() => ({ borderColor: colors.accentSoft, backgroundColor: colors.surface }), [colors]);

  return (
    <Screen title="Meditation" eyebrow="A little room to breathe" refreshing={resource.refreshing} onRefresh={() => void resource.reload()}>
      {resource.loading && <LoadingView label="Restoring your session…" />}
      {resource.error && !resource.data && <ErrorView message={resource.error} retry={() => void resource.reload()} />}
      {!resource.loading && !session && (
        <Card style={styles.setup}>
          <View style={[styles.leaf, { backgroundColor: colors.accentSoft }]}><Ionicons name="leaf" size={34} color={colors.accent} /></View>
          <AppText variant="title" style={styles.center}>How long feels kind?</AppText>
          <ChoiceChips value={duration} onChange={setDuration} options={[5, 10, 15, 20, 30].map(value => ({ value, label: `${value} min` }))} />
          <AppText variant="label">Mood before · {moodBefore}/10</AppText>
          <ChoiceChips value={moodBefore} onChange={setMoodBefore} options={[1,2,3,4,5,6,7,8,9,10].map(value => ({ value, label: String(value) }))} />
          {error && <AppText color="danger">{error}</AppText>}
          <AppButton label="Begin" icon="play" loading={saving} onPress={() => void start()} />
        </Card>
      )}
      {session && (
        <Card style={styles.session}>
          <View style={[styles.ring, ring]}>
            <AppText variant="display">{clock(remaining)}</AppText>
            <AppText variant="caption" color="muted">{session.running ? 'BREATHE' : 'PAUSED'}</AppText>
          </View>
          <View style={[styles.track, { backgroundColor: colors.accentSoft }]}><View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: colors.accent }]} /></View>
          <AppText color="muted" style={styles.center}>{Math.round(elapsed / 60)} of {Math.round(session.intendedLength / 60)} minutes</AppText>
          <AppButton label={session.running ? 'Pause' : 'Continue'} icon={session.running ? 'pause' : 'play'} loading={saving} onPress={() => void toggle()} />
          <AppText variant="label">Mood after · {moodAfter}/10</AppText>
          <ChoiceChips value={moodAfter} onChange={setMoodAfter} options={[1,2,3,4,5,6,7,8,9,10].map(value => ({ value, label: String(value) }))} />
          {error && <AppText color="danger">{error}</AppText>}
          <AppButton variant="ghost" label="Finish session" icon="checkmark-circle-outline" loading={saving} onPress={() => void finish()} />
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  setup: { gap: 20, alignItems: 'stretch' }, leaf: { width: 76, height: 76, borderRadius: 38, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' }, session: { gap: 20 }, ring: { width: 220, height: 220, borderRadius: 110, borderWidth: 14, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', gap: 4 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' }, fill: { height: 8, borderRadius: 4 },
});
