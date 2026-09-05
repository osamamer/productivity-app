import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { router, useNavigation } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { MeditationStats } from '@/components/meditation/MeditationStats';
import { AppButton } from '@/components/ui/AppButton';
import { AppSlider } from '@/components/ui/AppSlider';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { ModalSheet } from '@/components/ui/ModalSheet';
import { Screen } from '@/components/ui/Screen';
import { SilentPressable } from '@/components/ui/SilentPressable';
import { ErrorView, LoadingView } from '@/components/ui/StateView';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useMeditationAudio } from '@/hooks/useMeditationAudio';
import { clock } from '@/lib/date';
import { MEDITATION_SOUND_OPTIONS, type MeditationSoundId } from '@/lib/meditationAudio';
import { reportError } from '@/lib/errors';
import { useAppPopup } from '@/providers/PopupProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { api } from '@/services/api';
import type { MeditationSession } from '@/types/models';

const MIN_SESSION_MINUTES = 1;
const MAX_SESSION_MINUTES = 120;
const DURATION_ITEM_HEIGHT = 44;
const MIN_MOOD = 1;
const MAX_MOOD = 10;
const SOUND_STORAGE_KEY = 'mobile.meditation.sound';
const SOUND_ICONS: Record<MeditationSoundId, keyof typeof Ionicons.glyphMap> = {
  rain: 'rainy-outline',
  ocean: 'water-outline',
  forest: 'leaf-outline',
  bowls: 'musical-notes-outline',
};

function durationInSeconds(value: MeditationSession['totalSessionTime']): number {
  if (typeof value === 'number') return Math.max(0, Math.floor(value));
  if (Array.isArray(value)) return Math.max(0, Math.floor(value[0] + value[1] / 1_000_000_000));
  if (typeof value !== 'string') return 0;
  const match = value.match(/^PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/i);
  if (!match) return 0;
  return Math.max(0, Math.floor(
    Number(match[1] ?? 0) * 3_600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0),
  ));
}

function elapsedSince(timestamp: string, now: number): number {
  const candidates = [new Date(timestamp).getTime()];
  // The backend currently returns LocalDateTime without an offset. Try UTC too so
  // a phone in a different timezone does not treat a running session as future.
  if (!/(?:Z|[+-]\d{2}:?\d{2})$/i.test(timestamp)) {
    candidates.push(new Date(`${timestamp}Z`).getTime());
  }
  const elapsed = candidates
    .filter(candidate => Number.isFinite(candidate) && candidate <= now)
    .map(candidate => now - candidate);
  return elapsed.length > 0 ? Math.min(...elapsed) : 0;
}

interface ClientRunningAnchor {
  sessionId: string;
  startedAt: number;
}

function elapsedSeconds(session: MeditationSession, now: number, clientAnchor: ClientRunningAnchor | null): number {
  const saved = durationInSeconds(session.totalSessionTime);
  if (!session.running) return saved;
  if (clientAnchor?.sessionId === session.id) {
    return saved + Math.floor(Math.max(0, now - clientAnchor.startedAt) / 1_000);
  }
  if (!session.lastUnpauseTime) return saved;
  return saved + Math.floor(elapsedSince(session.lastUnpauseTime, now) / 1_000);
}

function moodLabel(mood: number): string {
  if (mood <= 2) return 'Very low';
  if (mood <= 4) return 'Low';
  if (mood <= 6) return 'Okay';
  if (mood <= 8) return 'Good';
  return 'Very good';
}

function soundOption(sound: MeditationSoundId) {
  return MEDITATION_SOUND_OPTIONS.find(option => option.id === sound) ?? MEDITATION_SOUND_OPTIONS[0];
}

type OptionSheet = 'mood' | 'duration' | 'bells' | 'sound' | null;

function SessionOptionRow({
  icon,
  label,
  value,
  onPress,
  active = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  onPress: () => void;
  active?: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <SilentPressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.optionRow,
        { backgroundColor: active ? colors.accentSoft : colors.background, borderColor: active ? colors.accent : colors.border },
        pressed && styles.pressed,
      ]}>
      <View style={[styles.optionIcon, { backgroundColor: active ? colors.accent : colors.surfaceRaised }]}>
        <Ionicons name={icon} size={18} color={active ? colors.onAccent : colors.accent} />
      </View>
      <AppText variant="label" style={styles.optionLabel}>{label}</AppText>
      <AppText variant="label" color={active ? 'accent' : 'muted'} style={styles.optionValue}>{value}</AppText>
      <Ionicons name="chevron-forward" size={17} color={colors.textMuted} />
    </SilentPressable>
  );
}

const DURATION_VALUES = Array.from(
  { length: MAX_SESSION_MINUTES - MIN_SESSION_MINUTES + 1 },
  (_, index) => index + MIN_SESSION_MINUTES,
);

function DurationPicker({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const { colors } = useAppTheme();
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: (value - MIN_SESSION_MINUTES) * DURATION_ITEM_HEIGHT, animated: false });
    });
    return () => cancelAnimationFrame(frame);
  }, [value]);

  function selectFromScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = Math.round(event.nativeEvent.contentOffset.y / DURATION_ITEM_HEIGHT);
    onChange(Math.max(MIN_SESSION_MINUTES, Math.min(MAX_SESSION_MINUTES, index + MIN_SESSION_MINUTES)));
  }

  function selectValue(minutes: number) {
    onChange(minutes);
    scrollRef.current?.scrollTo({ y: (minutes - MIN_SESSION_MINUTES) * DURATION_ITEM_HEIGHT, animated: true });
  }

  return (
    <View style={[styles.durationWheel, { borderColor: colors.border, backgroundColor: colors.background }]}>
      <ScrollView
        ref={scrollRef}
        nestedScrollEnabled
        snapToInterval={DURATION_ITEM_HEIGHT}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.durationOptions}
        onScrollEndDrag={selectFromScroll}
        onMomentumScrollEnd={selectFromScroll}
      >
        {DURATION_VALUES.map(minutes => {
          const selected = minutes === value;
          return (
            <SilentPressable
              key={minutes}
              accessibilityRole="button"
              accessibilityLabel={`${minutes} minutes`}
              accessibilityState={{ selected }}
              onPress={() => selectValue(minutes)}
              style={({ pressed }) => [
                styles.durationOption,
                { backgroundColor: selected ? colors.accentSoft : 'transparent' },
                pressed && styles.pressed,
              ]}
            >
              <AppText variant={selected ? 'heading' : 'body'} style={{ color: selected ? colors.accent : colors.textMuted, fontVariant: ['tabular-nums'] }}>
                {minutes}
              </AppText>
              {selected && <AppText variant="caption" color="accent">min</AppText>}
            </SilentPressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function SoundChoices({ selected, onChange, compact = false }: {
  selected: MeditationSoundId;
  onChange: (sound: MeditationSoundId) => void;
  compact?: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.soundGrid}>
      {MEDITATION_SOUND_OPTIONS.map(option => {
        const active = selected === option.id;
        return (
          <SilentPressable
            key={option.id}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.id)}
            style={({ pressed }) => [
              styles.soundChoice,
              compact && styles.soundChoiceCompact,
              { backgroundColor: active ? colors.accentSoft : colors.background, borderColor: active ? colors.accent : colors.border },
              pressed && styles.pressed,
            ]}>
            <View style={[styles.soundIcon, { backgroundColor: active ? colors.accent : colors.surfaceRaised }]}>
              <Ionicons name={SOUND_ICONS[option.id]} size={compact ? 17 : 19} color={active ? colors.onAccent : colors.accent} />
            </View>
            <View style={styles.grow}>
              <AppText variant="label">{option.label}</AppText>
              {!compact && <AppText variant="caption" color="muted" numberOfLines={1}>{option.description}</AppText>}
            </View>
            {active && <Ionicons name="checkmark-circle" size={18} color={colors.accent} />}
          </SilentPressable>
        );
      })}
    </View>
  );
}

export default function MeditationScreen() {
  const { colors } = useAppTheme();
  const navigation = useNavigation();
  const { confirm } = useAppPopup();
  const resource = useAsyncData<MeditationSession | undefined>(api.meditation.active);
  const setSessionData = resource.setData;
  const { start: startAudio, changeSound, pause: pauseAudio, resume: resumeAudio, stop: stopAudio, setMuted, playBell } = useMeditationAudio();
  const [durationMinutes, setDurationMinutes] = useState(10);
  const [moodBefore, setMoodBefore] = useState(5);
  const [moodAfter, setMoodAfter] = useState(5);
  const [numIntervalBells, setNumIntervalBells] = useState(2);
  const [selectedSound, setSelectedSound] = useState<MeditationSoundId>('rain');
  const [soundMuted, setSoundMuted] = useState(false);
  const [clientRunningAnchor, setClientRunningAnchor] = useState<ClientRunningAnchor | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [saving, setSaving] = useState(false);
  const [finishSheetOpen, setFinishSheetOpen] = useState(false);
  const [optionSheet, setOptionSheet] = useState<OptionSheet>(null);
  const [completedSession, setCompletedSession] = useState<MeditationSession | null>(null);
  const [statsRefreshKey, setStatsRefreshKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const bellSessionRef = useRef<string | null>(null);
  const lastBellRef = useRef(0);
  const audioStartedRef = useRef(false);
  const lastAppliedSoundRef = useRef<MeditationSoundId>('rain');
  const leavePromptOpenRef = useRef(false);
  const leavingRef = useRef(false);
  const [activeOpacity] = useState(() => new Animated.Value(0));
  const [activeScale] = useState(() => new Animated.Value(0.94));
  const [activeOffset] = useState(() => new Animated.Value(24));

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    void AsyncStorage.getItem(SOUND_STORAGE_KEY).then(stored => {
      if (stored && MEDITATION_SOUND_OPTIONS.some(option => option.id === stored)) {
        setSelectedSound(stored as MeditationSoundId);
      }
    }).catch(cause => console.error('Could not restore meditation sound preference:', cause));
  }, []);

  const session = resource.data ?? null;
  const elapsed = session ? elapsedSeconds(session, now, clientRunningAnchor) : 0;
  const remaining = session ? Math.max(0, session.intendedLength - elapsed) : 0;
  const progress = session?.intendedLength ? Math.min(1, elapsed / session.intendedLength) : 0;
  const sessionComplete = Boolean(session && session.intendedLength > 0 && remaining === 0);
  const sessionId = session?.id;
  const selectedSoundOption = useMemo(() => soundOption(selectedSound), [selectedSound]);

  useEffect(() => {
    if (!sessionId) return;
    activeOpacity.setValue(0);
    activeScale.setValue(0.94);
    activeOffset.setValue(24);
    const animation = Animated.parallel([
      Animated.timing(activeOpacity, { toValue: 1, duration: 360, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(activeScale, { toValue: 1, damping: 16, stiffness: 180, mass: 0.8, useNativeDriver: true }),
      Animated.timing(activeOffset, { toValue: 0, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [activeOffset, activeOpacity, activeScale, sessionId]);

  useEffect(() => {
    if (!session) {
      stopAudio();
      audioStartedRef.current = false;
      return;
    }
    if (!soundMuted && !audioStartedRef.current) {
      startAudio(selectedSound);
      lastAppliedSoundRef.current = selectedSound;
      audioStartedRef.current = true;
    }
  }, [session, selectedSound, soundMuted, startAudio, stopAudio]);

  useEffect(() => {
    if (!session || soundMuted || !audioStartedRef.current || lastAppliedSoundRef.current === selectedSound) return;
    changeSound(selectedSound);
    lastAppliedSoundRef.current = selectedSound;
  }, [changeSound, selectedSound, session, soundMuted]);

  useEffect(() => {
    if (!session || !session.intendedLength || !session.numIntervalBells) {
      bellSessionRef.current = null;
      lastBellRef.current = 0;
      return;
    }
    const secondsPerBell = session.intendedLength / (session.numIntervalBells + 1);
    const currentBell = Math.min(session.numIntervalBells, Math.floor(elapsed / secondsPerBell));
    if (bellSessionRef.current !== session.id) {
      bellSessionRef.current = session.id;
      lastBellRef.current = currentBell;
      return;
    }
    if (!session.running || currentBell <= lastBellRef.current) return;
    lastBellRef.current = currentBell;
    if (!soundMuted) playBell();
  }, [elapsed, playBell, session, soundMuted]);

  function chooseSound(sound: MeditationSoundId) {
    setSelectedSound(sound);
    void AsyncStorage.setItem(SOUND_STORAGE_KEY, sound).catch(cause => console.error('Could not save meditation sound preference:', cause));
    if (session && !soundMuted) {
      changeSound(sound);
      lastAppliedSoundRef.current = sound;
      audioStartedRef.current = true;
    }
  }

  async function start() {
    setSaving(true);
    setError(null);
    if (!soundMuted) {
      startAudio(selectedSound);
      lastAppliedSoundRef.current = selectedSound;
      audioStartedRef.current = true;
    }
    try {
      const started = await api.meditation.start(moodBefore, durationMinutes * 60, numIntervalBells);
      setClientRunningAnchor({ sessionId: started.id, startedAt: Date.now() });
      resource.setData(started);
      setCompletedSession(null);
    } catch (cause) {
      stopAudio();
      audioStartedRef.current = false;
      setClientRunningAnchor(null);
      setError(reportError('Could not start meditation', cause));
    } finally {
      setSaving(false);
    }
  }

  async function togglePause() {
    if (!session) return;
    setSaving(true);
    setError(null);
    try {
      const updated = session.running ? await api.meditation.pause(session.id) : await api.meditation.resume(session.id);
      resource.setData(updated);
      if (updated.running) {
        setClientRunningAnchor({ sessionId: updated.id, startedAt: Date.now() });
        if (!soundMuted) resumeAudio();
      } else {
        setClientRunningAnchor(null);
        pauseAudio();
      }
    } catch (cause) {
      setError(reportError('Could not update meditation', cause));
    } finally {
      setSaving(false);
    }
  }

  function toggleSound() {
    if (soundMuted) {
      setMuted(false);
      setSoundMuted(false);
      if (session) {
        startAudio(selectedSound);
        lastAppliedSoundRef.current = selectedSound;
        audioStartedRef.current = true;
      }
    } else {
      setMuted(true);
      pauseAudio();
      setSoundMuted(true);
    }
  }

  async function finish() {
    if (!session) return;
    setSaving(true);
    setError(null);
    try {
      const finished = await api.meditation.end(session.id, moodAfter);
      resource.setData(undefined);
      setClientRunningAnchor(null);
      setCompletedSession(finished);
      setStatsRefreshKey(key => key + 1);
      setFinishSheetOpen(false);
      stopAudio();
      audioStartedRef.current = false;
    } catch (cause) {
      setError(reportError('Could not finish meditation', cause));
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (!session) return;

    const unsubscribe = navigation.addListener('beforeRemove', event => {
      if (leavingRef.current) return;
      event.preventDefault();
      if (leavePromptOpenRef.current) return;

      leavePromptOpenRef.current = true;
      void (async () => {
        const shouldLeave = await confirm(
          'End meditation and leave?',
          'Your meditation session is still active. Leaving will end and save the session.',
          'End session and leave',
          'Keep meditating',
        );
        leavePromptOpenRef.current = false;
        if (!shouldLeave) return;

        leavingRef.current = true;
        setSaving(true);
        setError(null);
        try {
          await api.meditation.end(session.id);
          setSessionData(undefined);
          setClientRunningAnchor(null);
          setFinishSheetOpen(false);
          stopAudio();
          audioStartedRef.current = false;
          navigation.dispatch(event.data.action);
        } catch (cause) {
          leavingRef.current = false;
          setError(reportError('Could not end meditation while leaving', cause));
        } finally {
          setSaving(false);
        }
      })();
    });

    return unsubscribe;
  }, [confirm, navigation, session, setSessionData, stopAudio]);

  return (
    <Screen contentStyle={styles.screenContent} refreshing={resource.refreshing} onRefresh={() => void resource.reload()}>
      {resource.loading && <LoadingView label="Restoring your session…" />}
      {resource.error && !resource.data && <ErrorView message={resource.error} retry={() => void resource.reload()} />}
      {error && <AppText color="danger" style={styles.error}>{error}</AppText>}

      {!resource.loading && !session && (
        <Card style={styles.setup}>
          <View style={styles.setupIntro}>
            <View style={[styles.leaf, { backgroundColor: colors.accentSoft }]}>
              <Ionicons name="leaf" size={34} color={colors.accent} />
            </View>
            <AppText color="muted" style={styles.setupIntroCopy}>Choose a length, check in with yourself, and make some quiet space.</AppText>
          </View>
          <View style={styles.optionList}>
            <SessionOptionRow
              icon="happy-outline"
              label="Mood before"
              value={`${moodBefore} · ${moodLabel(moodBefore)}`}
              onPress={() => setOptionSheet('mood')}
            />
            <SessionOptionRow
              icon="time-outline"
              label="Session length"
              value={`${durationMinutes} min`}
              onPress={() => setOptionSheet('duration')}
            />
            <SessionOptionRow
              icon="notifications-outline"
              label="Interval bells"
              value={numIntervalBells === 0 ? 'No bells' : `${numIntervalBells} bells`}
              onPress={() => setOptionSheet('bells')}
            />
            <SessionOptionRow
              icon={SOUND_ICONS[selectedSound]}
              label="Soundscape"
              value={selectedSoundOption.label}
              onPress={() => setOptionSheet('sound')}
            />
          </View>
          <AppButton label="Begin meditation" icon="play" loading={saving} onPress={() => void start()} />
          {completedSession && (
            <View style={[styles.completed, { backgroundColor: `${colors.success}18`, borderColor: `${colors.success}55` }]}>
              <Ionicons name="checkmark-circle" size={22} color={colors.success} />
              <View style={styles.grow}>
                <AppText variant="label" color="success">Meditation saved</AppText>
                <AppText variant="caption" color="muted">You spent {clock(durationInSeconds(completedSession.totalSessionTime))} in stillness.</AppText>
              </View>
              <SilentPressable accessibilityRole="button" accessibilityLabel="Dismiss saved meditation" onPress={() => setCompletedSession(null)} hitSlop={10}>
                <Ionicons name="close" size={19} color={colors.textMuted} />
              </SilentPressable>
            </View>
          )}
        </Card>
      )}

      {session && (
        <Animated.View style={[styles.activeAnimation, { opacity: activeOpacity, transform: [{ translateY: activeOffset }, { scale: activeScale }] }]}>
          <Card style={styles.active}>
            <View style={[styles.timerRing, { borderColor: colors.accentSoft }]}>
              <Ionicons name="leaf" size={28} color={colors.accent} />
              <AppText variant="display" style={styles.timer}>{clock(remaining)}</AppText>
              <AppText variant="caption" color="muted">{sessionComplete ? 'TIME IS UP' : session.running ? 'REMAINING' : 'PAUSED'}</AppText>
            </View>
            <View style={[styles.track, { backgroundColor: colors.accentSoft }]}><View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: colors.accent }]} /></View>
            <View style={styles.activeIntro}>
              <AppText variant="title" style={styles.center}>{sessionComplete ? 'Beautifully done.' : session.running ? 'Be here.' : 'Paused.'}</AppText>
              <AppText color="muted" style={styles.center}>{sessionComplete ? 'Take a moment before you close the session.' : `${session.numIntervalBells} interval bell${session.numIntervalBells === 1 ? '' : 's'} · ${Math.round(session.intendedLength / 60)} minutes`}</AppText>
            </View>
            <View style={styles.activeSoundControls}>
              <SessionOptionRow
                icon={SOUND_ICONS[selectedSound]}
                label="Soundscape"
                value={selectedSoundOption.label}
                active={!soundMuted}
                onPress={() => setOptionSheet('sound')}
              />
              <AppButton compact variant="secondary" label={soundMuted ? 'Turn sound on' : 'Mute sound'} icon={soundMuted ? 'volume-mute-outline' : 'volume-high-outline'} onPress={toggleSound} />
            </View>
            <View style={styles.actions}>
              {!sessionComplete && <AppButton style={styles.action} variant="secondary" label={session.running ? 'Pause' : 'Resume'} icon={session.running ? 'pause' : 'play'} loading={saving} onPress={() => void togglePause()} />}
              <AppButton style={styles.action} variant={sessionComplete ? 'primary' : 'ghost'} label={sessionComplete ? 'Finish session' : 'End early'} icon={sessionComplete ? 'checkmark-circle-outline' : 'stop-circle-outline'} loading={saving} onPress={() => setFinishSheetOpen(true)} />
            </View>
          </Card>
        </Animated.View>
      )}

      {!session && <MeditationStats compact refreshKey={statsRefreshKey} onViewCalendar={() => router.push('/meditation-calendar')} />}

      <ModalSheet visible={optionSheet === 'mood'} onClose={() => setOptionSheet(null)} title="Mood before meditation">
        <View style={styles.sheetValue}><AppText variant="display">{moodBefore}</AppText><AppText color="muted">{moodLabel(moodBefore)}</AppText></View>
        <AppSlider label="Mood before meditation" value={moodBefore} minimumValue={MIN_MOOD} maximumValue={MAX_MOOD} minimumLabel="Very low" maximumLabel="Very good" onValueChange={setMoodBefore} />
      </ModalSheet>

      <ModalSheet visible={optionSheet === 'duration'} onClose={() => setOptionSheet(null)} title="Session length">
        <View style={styles.sheetValue}><AppText variant="display">{durationMinutes}</AppText><AppText color="muted">minutes</AppText></View>
        <DurationPicker value={durationMinutes} onChange={setDurationMinutes} />
      </ModalSheet>

      <ModalSheet visible={optionSheet === 'bells'} onClose={() => setOptionSheet(null)} title="Interval bells">
        <View style={styles.sheetValue}><AppText variant="display">{numIntervalBells}</AppText><AppText color="muted">{numIntervalBells === 1 ? 'bell' : 'bells'}</AppText></View>
        <AppSlider label="Interval bells" value={numIntervalBells} minimumValue={0} maximumValue={10} minimumLabel="No bells" maximumLabel="10 bells" onValueChange={setNumIntervalBells} />
      </ModalSheet>

      <ModalSheet visible={optionSheet === 'sound'} onClose={() => setOptionSheet(null)} title="Soundscape">
        <SoundChoices selected={selectedSound} onChange={chooseSound} compact />
      </ModalSheet>

      <ModalSheet
        visible={finishSheetOpen}
        onClose={() => !saving && setFinishSheetOpen(false)}
        title="How do you feel now?"
        footer={<AppButton label="Save session" icon="checkmark-circle-outline" loading={saving} onPress={() => void finish()} />}>
        <AppText color="muted">Save a quick check-in with this meditation session.</AppText>
        <View style={styles.sectionHeading}><AppText variant="label">Mood after meditation</AppText><AppText variant="label" color="muted">{moodAfter} · {moodLabel(moodAfter)}</AppText></View>
        <AppSlider label="Mood after meditation" value={moodAfter} minimumValue={MIN_MOOD} maximumValue={MAX_MOOD} minimumLabel="Very low" maximumLabel="Very good" onValueChange={setMoodAfter} />
      </ModalSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenContent: { paddingTop: 0 },
  setup: { gap: 16, paddingTop: 12 },
  setupIntro: { alignItems: 'center', gap: 10 },
  setupIntroCopy: { textAlign: 'center' },
  leaf: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  optionList: { gap: 9 },
  optionRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 11, borderRadius: 15, borderWidth: 1 },
  optionIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  optionLabel: { flex: 1 },
  optionValue: { maxWidth: '44%', textAlign: 'right' },
  completed: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 15, padding: 12 },
  center: { textAlign: 'center' },
  sectionHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
  sheetValue: { alignItems: 'center', gap: 3 },
  durationWheel: { height: DURATION_ITEM_HEIGHT * 3, borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  durationOptions: { paddingVertical: DURATION_ITEM_HEIGHT },
  durationOption: { height: DURATION_ITEM_HEIGHT, marginHorizontal: 8, borderRadius: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  soundGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  soundChoice: { width: '100%', minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 15, borderWidth: 1 },
  soundChoiceCompact: { width: '48%', minHeight: 48, padding: 8, gap: 7 },
  soundIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  grow: { flex: 1 },
  activeAnimation: { width: '100%' },
  active: { alignItems: 'stretch', gap: 18 },
  timerRing: { width: 236, height: 236, borderRadius: 118, borderWidth: 14, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', gap: 5 },
  timer: { fontVariant: ['tabular-nums'] },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  activeIntro: { gap: 7 },
  activeSoundControls: { gap: 10 },
  actions: { flexDirection: 'row', gap: 10 },
  action: { flex: 1 },
  error: { marginHorizontal: 2 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.985 }] },
});
