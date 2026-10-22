import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { AppSlider } from '@/components/ui/AppSlider';
import { MentalStateBadge } from '@/components/mind/MentalStateBadge';
import { Screen } from '@/components/ui/Screen';
import { SilentPressable } from '@/components/ui/SilentPressable';
import { ErrorView, LoadingView } from '@/components/ui/StateView';
import { useAsyncData } from '@/hooks/useAsyncData';
import { reportError } from '@/lib/errors';
import { useAppTheme } from '@/providers/ThemeProvider';
import { api } from '@/services/api';
import { MENTAL_STATE_GOAL_LABELS, type MentalStateCheckIn, type MentalStateGoal, type MentalStateSignals } from '@/types/models';

const goals: MentalStateGoal[] = ['LABOR', 'LEISURE', 'RECOVERY'];

const signalGroups: { label: string; signals: { key: keyof MentalStateSignals; label: string }[] }[] = [
  {
    label: 'Energy & pace',
    signals: [
      { key: 'energy', label: 'Energy' },
      { key: 'activation', label: 'Activation' },
    ],
  },
  {
    label: 'Attention',
    signals: [
      { key: 'stimulationHunger', label: 'Stimulation hunger' },
      { key: 'clarity', label: 'Clarity' },
    ],
  },
  {
    label: 'Emotions',
    signals: [
      { key: 'valence', label: 'Emotional tone' },
      { key: 'emotionalLoad', label: 'Emotional load' },
    ],
  },
];

const RECENT_CHECK_IN_LIMIT = 5;
const CURRENT_STATE_WINDOW_MS = 60 * 60 * 1000;

function isRecentCheckIn(checkIn: MentalStateCheckIn | null, now: number): boolean {
  if (!checkIn) return false;

  const recordedAt = Date.parse(checkIn.recordedAt);
  return Number.isFinite(recordedAt) && now - recordedAt <= CURRENT_STATE_WINDOW_MS;
}

function formatCheckInDateTime(recordedAt: string): string {
  const date = new Date(recordedAt);
  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const isToday = date.toDateString() === new Date().toDateString();
  return isToday ? `Today · ${time}` : `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${time}`;
}

function stateNameStyle(state: string) {
  if (state.length > 21) return { fontSize: 20, lineHeight: 25 };
  if (state.length > 16) return { fontSize: 22, lineHeight: 27 };
  return undefined;
}

interface MentalStateResultCardProps {
  checkIn: MentalStateCheckIn;
  selected: boolean;
  isCurrent: boolean;
  isMostRecent: boolean;
  onCheckInAgain: () => void;
  onGoToMostRecent: () => void;
}

function MentalStateResultCard({ checkIn, selected, isCurrent, isMostRecent, onCheckInAgain, onGoToMostRecent }: MentalStateResultCardProps) {
  const { colors } = useAppTheme();
  const [animations] = useState(() => ({
    opacity: new Animated.Value(0),
    translateY: new Animated.Value(12),
    recommendationOpacity: new Animated.Value(0),
    recommendationTranslateY: new Animated.Value(8),
  }));
  const { opacity, translateY, recommendationOpacity, recommendationTranslateY } = animations;
  const readyForHome = checkIn.state === 'Ready' || checkIn.state === 'Almost Ready';
  const meditationGoal = checkIn.goal === 'RECOVERY' || !readyForHome;
  const destination = checkIn.goal === 'LEISURE' ? null : meditationGoal ? '/meditation' : '/(tabs)';

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
        <View style={styles.resultHeading}>
          <MentalStateBadge state={checkIn.state} plain />
          <View style={styles.resultHeadingCopy}>
            <AppText variant="caption" color="muted">{selected ? 'SELECTED CHECK-IN' : 'YOUR STATE'}</AppText>
            <AppText variant="title" numberOfLines={1} style={stateNameStyle(checkIn.state)}>{checkIn.state}</AppText>
            <View style={[styles.goalPill, { backgroundColor: colors.accentSoft }]}>
              <AppText variant="caption" color="accent">{MENTAL_STATE_GOAL_LABELS[checkIn.goal]}</AppText>
            </View>
          </View>
        </View>
        <Animated.View style={{ opacity: recommendationOpacity, transform: [{ translateY: recommendationTranslateY }] }}>
          <AppText variant="caption" color="muted">{isCurrent ? 'WHAT MAY HELP NOW' : 'RECOMMENDATION FOR THIS CHECK-IN'}</AppText>
          <View style={styles.recommendations}>
            {checkIn.suggestedActions.map(action => <AppText key={action}>{action}</AppText>)}
          </View>
        </Animated.View>
        {isMostRecent ? (
          <>
            {destination && (
              <AppButton
                label={meditationGoal ? 'Go to meditation' : 'Go to home'}
                icon={meditationGoal ? 'leaf-outline' : 'home-outline'}
                variant={meditationGoal ? 'secondary' : 'primary'}
                onPress={() => router.push(destination)}
              />
            )}
            <AppButton label="Check in again" icon="refresh-outline" variant="secondary" onPress={onCheckInAgain} />
          </>
        ) : (
          <AppButton label="Go to most recent" icon="list-outline" variant="secondary" onPress={onGoToMostRecent} />
        )}
      </Card>
    </Animated.View>
  );
}

export default function MentalStateScreen() {
  const { colors } = useAppTheme();
  const resource = useAsyncData(() => api.mentalState.history());
  const [values, setValues] = useState<MentalStateSignals>({ energy: 5, activation: 5, stimulationHunger: 5, clarity: 5, valence: 5, emotionalLoad: 5 });
  const [goal, setGoal] = useState<MentalStateGoal | null>(null);
  const [result, setResult] = useState<MentalStateCheckIn | null>(null);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<MentalStateCheckIn | null>(null);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const recentResult = isRecentCheckIn(result, now) ? result : null;
  const latestCheckIn = result ?? resource.data?.[0] ?? null;
  const recentCheckIn = recentResult ?? (isRecentCheckIn(latestCheckIn, now) ? latestCheckIn : null);
  const displayedCheckIn = selectedHistoryItem ?? (isCheckingIn ? null : recentCheckIn);
  const displayedIsCurrent = isRecentCheckIn(displayedCheckIn, now);
  const displayedIsMostRecent = displayedCheckIn !== null && displayedCheckIn.id === latestCheckIn?.id;
  function startAnotherCheckIn() {
    setResult(null);
    setSelectedHistoryItem(null);
    setGoal(null);
    setIsCheckingIn(true);
    setError(null);
  }

  function goToMostRecent() {
    if (!latestCheckIn) return;
    setSelectedHistoryItem(latestCheckIn);
    setResult(null);
  }

  async function submit() {
    if (!goal) return;
    setSaving(true); setError(null);
    try {
      const checkIn = await api.mentalState.checkIn({ ...values, goal });
      setResult(checkIn);
      setSelectedHistoryItem(null);
      setIsCheckingIn(false);
      resource.setData(current => current ? [checkIn, ...current] : [checkIn]);
    } catch (cause) { setError(reportError('Could not save mental state check-in', cause)); }
    finally { setSaving(false); }
  }

  return (
    <Screen
      back
      contentStyle={styles.content}
      scrollToTopKey={result?.id}
      refreshing={resource.refreshing}
      onRefresh={() => void resource.reload()}
    >
      {resource.loading && !resource.data ? (
        <LoadingView />
      ) : displayedCheckIn ? (
        <MentalStateResultCard
          checkIn={displayedCheckIn}
          selected={selectedHistoryItem !== null}
          isCurrent={displayedIsCurrent}
          isMostRecent={displayedIsMostRecent}
          onCheckInAgain={startAnotherCheckIn}
          onGoToMostRecent={goToMostRecent}
        />
      ) : (
        <Card style={styles.form}>
          <View style={styles.goalSection}>
            <AppText variant="label">What are we doing?</AppText>
            <View style={styles.goals}>
              {goals.map(option => {
                const selected = goal === option;
                return (
                  <SilentPressable
                    key={option}
                    accessibilityRole="radio"
                    accessibilityLabel={MENTAL_STATE_GOAL_LABELS[option]}
                    accessibilityState={{ checked: selected }}
                    onPress={() => setGoal(option)}
                    style={({ pressed }) => [
                      styles.goalChoice,
                      { borderColor: selected ? colors.accent : colors.border, backgroundColor: colors.surface },
                      pressed && styles.pressed,
                    ]}>
                    <AppText variant="label" color={selected ? 'accent' : 'default'}>{MENTAL_STATE_GOAL_LABELS[option]}</AppText>
                  </SilentPressable>
                );
              })}
            </View>
          </View>
          <View style={styles.signalGroups}>
            {signalGroups.map((group, index) => (
              <View key={group.label} style={[styles.signalGroup, index > 0 && styles.signalGroupSeparated, index > 0 && { borderColor: `${colors.accent}55` }]}>
                <AppText variant="label" style={styles.signalGroupTitle}>{group.label.toUpperCase()}</AppText>
                <View style={styles.signalGroupItems}>
                  {group.signals.map(signal => (
                    <View key={signal.key} style={styles.signal}>
                      <View style={styles.spaceBetween}>
                        <AppText variant="label">{signal.label}</AppText>
                        <View style={[styles.ratingPill, { backgroundColor: colors.accentSoft }]}>
                          <AppText variant="caption" color="accent">{values[signal.key]}/10</AppText>
                        </View>
                      </View>
                      <AppSlider
                        label={signal.label}
                        value={values[signal.key]}
                        onValueChange={value => setValues(current => ({ ...current, [signal.key]: value }))}
                      />
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
          {error && <AppText color="danger">{error}</AppText>}
          <AppButton label="Check in" icon="sparkles-outline" loading={saving} disabled={!goal} onPress={() => void submit()} />
        </Card>
      )}
      <AppText variant="heading">Recent check-ins</AppText>
      {resource.error && !resource.data && <ErrorView message={resource.error} retry={() => void resource.reload()} />}
      <View style={styles.history}>
        {(resource.data ?? []).slice(0, RECENT_CHECK_IN_LIMIT).map(item => (
          <SilentPressable
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={`View ${item.state}, ${MENTAL_STATE_GOAL_LABELS[item.goal]} check-in`}
            accessibilityState={{ selected: selectedHistoryItem?.id === item.id }}
            onPress={() => { setSelectedHistoryItem(item); setResult(null); }}
            style={({ pressed }) => [
              styles.historyCard,
              { backgroundColor: colors.surface, borderColor: selectedHistoryItem?.id === item.id ? colors.accent : colors.border },
              selectedHistoryItem?.id === item.id && styles.historyCardSelected,
              pressed && styles.pressed,
            ]}>
            <MentalStateBadge state={item.state} size="small" plain />
            <View style={styles.grow}>
              <AppText variant="label" numberOfLines={1}>{item.state}</AppText>
              <AppText variant="caption" color="muted">{formatCheckInDateTime(item.recordedAt)}</AppText>
            </View>
            <Ionicons name="chevron-forward" size={17} color={colors.textMuted} />
          </SilentPressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 0 },
  form: { gap: 18 }, goalSection: { gap: 8 }, goals: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, goalChoice: { minHeight: 42, paddingHorizontal: 14, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  signalGroups: { gap: 14 }, signalGroup: { gap: 10 }, signalGroupSeparated: { borderTopWidth: 1, paddingTop: 12 }, signalGroupTitle: { letterSpacing: 0.8 }, signalGroupItems: { gap: 14 }, signal: { gap: 6 }, spaceBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }, ratingPill: { minWidth: 48, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10, alignItems: 'center' },
  result: { gap: 12 }, resultHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 }, resultHeadingCopy: { flex: 1, gap: 3, minWidth: 0 }, goalPill: { alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10 }, recommendations: { gap: 7, marginTop: 2 }, history: { gap: 10 }, historyCard: { minHeight: 68, borderWidth: 1, borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }, historyCardSelected: { borderWidth: 2 }, grow: { flex: 1, gap: 3, minWidth: 0 }, pressed: { opacity: 0.72 },
});
