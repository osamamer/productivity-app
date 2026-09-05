import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { AppSlider } from '@/components/ui/AppSlider';
import { Screen } from '@/components/ui/Screen';
import { SilentPressable } from '@/components/ui/SilentPressable';
import { ErrorView, LoadingView } from '@/components/ui/StateView';
import { useAsyncData } from '@/hooks/useAsyncData';
import { reportError } from '@/lib/errors';
import { useAppTheme } from '@/providers/ThemeProvider';
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

const RECENT_CHECK_IN_LIMIT = 5;

interface MentalStateResultCardProps {
  checkIn: MentalStateCheckIn;
  selected: boolean;
  onCheckInAgain: () => void;
}

function MentalStateResultCard({ checkIn, selected, onCheckInAgain }: MentalStateResultCardProps) {
  const [animations] = useState(() => ({
    opacity: new Animated.Value(0),
    translateY: new Animated.Value(12),
    recommendationOpacity: new Animated.Value(0),
    recommendationTranslateY: new Animated.Value(8),
  }));
  const { opacity, translateY, recommendationOpacity, recommendationTranslateY } = animations;
  const readyForHome = checkIn.state === 'Ready' || checkIn.state === 'Almost Ready';

  useEffect(() => {
    opacity.setValue(0);
    translateY.setValue(12);
    recommendationOpacity.setValue(0);
    recommendationTranslateY.setValue(8);

    const cardEntrance = Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]);
    const recommendationEntrance = Animated.parallel([
      Animated.timing(recommendationOpacity, { toValue: 1, duration: 280, delay: 100, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(recommendationTranslateY, { toValue: 0, duration: 280, delay: 100, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]);

    cardEntrance.start();
    recommendationEntrance.start();
    return () => {
      cardEntrance.stop();
      recommendationEntrance.stop();
    };
  }, [checkIn.id, opacity, recommendationOpacity, recommendationTranslateY, translateY]);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <Card style={styles.result}>
        <AppText variant="caption" color="accent">{selected ? 'SELECTED CHECK-IN' : 'YOUR STATE'}</AppText>
        <AppText variant="title">{checkIn.state}</AppText>
        <Animated.View style={{ opacity: recommendationOpacity, transform: [{ translateY: recommendationTranslateY }] }}>
          <AppText variant="caption" color="accent">WHAT MAY HELP NOW</AppText>
          <View style={styles.recommendations}>
            {checkIn.suggestedActions.map(action => <AppText key={action}>{action}</AppText>)}
          </View>
        </Animated.View>
        <AppButton
          label={readyForHome ? 'Go to home' : 'Go to meditation'}
          icon={readyForHome ? 'home-outline' : 'leaf-outline'}
          variant={readyForHome ? 'primary' : 'secondary'}
          onPress={() => router.push(readyForHome ? '/(tabs)' : '/meditation')}
        />
        <AppButton label="Check in again" icon="refresh-outline" variant="secondary" onPress={onCheckInAgain} />
      </Card>
    </Animated.View>
  );
}

export default function MentalStateScreen() {
  const { colors } = useAppTheme();
  const resource = useAsyncData(() => api.mentalState.history());
  const [values, setValues] = useState<MentalStateRequest>({ energy: 5, activation: 5, stimulationHunger: 5, clarity: 5, valence: 5, emotionalLoad: 5 });
  const [result, setResult] = useState<MentalStateCheckIn | null>(null);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<MentalStateCheckIn | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const displayedCheckIn = selectedHistoryItem ?? result;

  function startAnotherCheckIn() {
    setResult(null);
    setSelectedHistoryItem(null);
    setError(null);
  }

  async function submit() {
    setSaving(true); setError(null);
    try {
      const checkIn = await api.mentalState.checkIn(values);
      setResult(checkIn);
      setSelectedHistoryItem(null);
      resource.setData(current => current ? [checkIn, ...current] : [checkIn]);
    } catch (cause) { setError(reportError('Could not save mental state check-in', cause)); }
    finally { setSaving(false); }
  }

  return (
    <Screen safeAreaTop={false} contentStyle={styles.content} refreshing={resource.refreshing} onRefresh={() => void resource.reload()}>
      {displayedCheckIn ? (
        <MentalStateResultCard
          checkIn={displayedCheckIn}
          selected={selectedHistoryItem !== null}
          onCheckInAgain={startAnotherCheckIn}
        />
      ) : (
        <Card style={styles.form}>
          {signals.map(signal => (
            <View key={signal.key} style={styles.signal}>
              <View style={styles.spaceBetween}><AppText variant="label">{signal.label}</AppText><AppText variant="label" color="accent">{values[signal.key]}/10</AppText></View>
              <AppSlider
                label={signal.label}
                value={values[signal.key]}
                minimumLabel={signal.low}
                maximumLabel={signal.high}
                onValueChange={value => setValues(current => ({ ...current, [signal.key]: value }))}
              />
            </View>
          ))}
          {error && <AppText color="danger">{error}</AppText>}
          <AppButton label="Check in" icon="sparkles-outline" loading={saving} onPress={() => void submit()} />
        </Card>
      )}
      <AppText variant="heading">Recent check-ins</AppText>
      {resource.loading && <LoadingView />}
      {resource.error && !resource.data && <ErrorView message={resource.error} retry={() => void resource.reload()} />}
      <View style={styles.history}>
        {(resource.data ?? []).slice(0, RECENT_CHECK_IN_LIMIT).map(item => (
          <SilentPressable
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={`View ${item.state} check-in`}
            accessibilityState={{ selected: selectedHistoryItem?.id === item.id }}
            onPress={() => { setSelectedHistoryItem(item); setResult(null); }}
            style={({ pressed }) => [
              styles.historyCard,
              { backgroundColor: colors.surface, borderColor: selectedHistoryItem?.id === item.id ? colors.accent : colors.border },
              selectedHistoryItem?.id === item.id && styles.historyCardSelected,
              pressed && styles.pressed,
            ]}>
            <View style={styles.grow}><AppText variant="label">{item.state}</AppText><AppText variant="caption" color="muted">{new Date(item.recordedAt).toLocaleString()}</AppText></View>
            <AppText variant="caption" color="accent">{item.suggestedActions.length} suggestions</AppText>
            <Ionicons name="chevron-forward" size={17} color={colors.textMuted} />
          </SilentPressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 0 },
  form: { gap: 22 }, signal: { gap: 8 }, spaceBetween: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  result: { gap: 9 }, recommendations: { gap: 7, marginTop: 2 }, history: { gap: 10 }, historyCard: { minHeight: 68, borderWidth: 1, borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }, historyCardSelected: { borderWidth: 2 }, grow: { flex: 1, gap: 3 }, pressed: { opacity: 0.72 },
});
