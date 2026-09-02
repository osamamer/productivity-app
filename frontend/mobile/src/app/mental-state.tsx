import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { ChoiceChips } from '@/components/ui/ChoiceChips';
import { Screen } from '@/components/ui/Screen';
import { ErrorView, LoadingView } from '@/components/ui/StateView';
import { useAsyncData } from '@/hooks/useAsyncData';
import { reportError } from '@/lib/errors';
import { api } from '@/services/api';
import type { MentalStateCheckIn, MentalStateRequest } from '@/types/models';

const signals: { key: keyof MentalStateRequest; label: string; low: string; high: string }[] = [
  { key: 'energy', label: 'Energy', low: 'Drained', high: 'Charged' },
  { key: 'activation', label: 'Activation', low: 'Still', high: 'Revved up' },
  { key: 'stimulationHunger', label: 'Stimulation hunger', low: 'Content', high: 'Seeking input' },
  { key: 'clarity', label: 'Clarity', low: 'Foggy', high: 'Clear' },
  { key: 'valence', label: 'Emotional tone', low: 'Heavy', high: 'Positive' },
  { key: 'emotionalLoad', label: 'Emotional load', low: 'Light', high: 'Full' },
];

export default function MentalStateScreen() {
  const resource = useAsyncData(() => api.mentalState.history());
  const [values, setValues] = useState<MentalStateRequest>({ energy: 5, activation: 5, stimulationHunger: 5, clarity: 5, valence: 5, emotionalLoad: 5 });
  const [result, setResult] = useState<MentalStateCheckIn | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSaving(true); setError(null);
    try {
      const checkIn = await api.mentalState.checkIn(values);
      setResult(checkIn);
      resource.setData(current => current ? [checkIn, ...current] : [checkIn]);
    } catch (cause) { setError(reportError('Could not save mental state check-in', cause)); }
    finally { setSaving(false); }
  }

  return (
    <Screen title="Mental state" eyebrow="Six signals, one honest moment" refreshing={resource.refreshing} onRefresh={() => void resource.reload()}>
      <Card style={styles.form}>
        {signals.map(signal => (
          <View key={signal.key} style={styles.signal}>
            <View style={styles.spaceBetween}><AppText variant="label">{signal.label}</AppText><AppText variant="label" color="accent">{values[signal.key]}/10</AppText></View>
            <ChoiceChips value={values[signal.key]} onChange={value => setValues(current => ({ ...current, [signal.key]: value }))} options={[1,2,3,4,5,6,7,8,9,10].map(value => ({ value, label: String(value) }))} />
            <View style={styles.spaceBetween}><AppText variant="caption" color="muted">{signal.low}</AppText><AppText variant="caption" color="muted">{signal.high}</AppText></View>
          </View>
        ))}
        {error && <AppText color="danger">{error}</AppText>}
        <AppButton label="Check in" icon="sparkles-outline" loading={saving} onPress={() => void submit()} />
      </Card>
      {result && (
        <Card style={styles.result}>
          <AppText variant="caption" color="accent">YOUR STATE</AppText>
          <AppText variant="title">{result.state}</AppText>
          {result.suggestedActions.map(action => <AppText key={action}>• {action}</AppText>)}
        </Card>
      )}
      <AppText variant="heading">Recent check-ins</AppText>
      {resource.loading && <LoadingView />}
      {resource.error && !resource.data && <ErrorView message={resource.error} retry={() => void resource.reload()} />}
      <View style={styles.history}>
        {(resource.data ?? []).map(item => (
          <Card key={item.id} style={styles.historyCard}>
            <View style={styles.grow}><AppText variant="label">{item.state}</AppText><AppText variant="caption" color="muted">{new Date(item.recordedAt).toLocaleString()}</AppText></View>
            <AppText variant="caption" color="accent">{item.suggestedActions.length} suggestions</AppText>
          </Card>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: 22 }, signal: { gap: 8 }, spaceBetween: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  result: { gap: 9 }, history: { gap: 10 }, historyCard: { flexDirection: 'row', alignItems: 'center', gap: 12 }, grow: { flex: 1, gap: 3 },
});
