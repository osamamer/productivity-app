import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { usePomodoroAudio } from '@/hooks/usePomodoroAudio';
import { appConfig } from '@/lib/config';
import { GENERIC_ERROR_MESSAGE } from '@/lib/errors';
import { playAudioFeedback } from '@/lib/audioFeedback';
import { useAuth } from '@/providers/AuthProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { resolveAccessToken } from '@/services/auth-session';
import { api } from '@/services/api';
import type { PomodoroConfig, PomodoroStatus } from '@/types/models';
import { AppButton } from '../ui/AppButton';
import { AppInput } from '../ui/AppInput';
import { AppText } from '../ui/AppText';
import { ModalSheet } from '../ui/ModalSheet';

interface PomodoroFormValues {
  focusDuration: number;
  shortBreakDuration: number;
  longBreakDuration: number;
  numFocuses: number;
  longBreakCooldown: number;
}

const DEFAULT_CONFIG: PomodoroConfig = {
  secondsMode: false,
  durationUnit: 'minutes',
  defaultFocusDuration: 25,
  defaultShortBreakDuration: 5,
  defaultLongBreakDuration: 15,
};

const DEFAULT_FORM: PomodoroFormValues = {
  focusDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  numFocuses: 4,
  longBreakCooldown: 4,
};

const BROWN_NOISE_STORAGE_KEY = 'solife.pomodoro-brown-noise-enabled';
const POMODORO_FORM_STORAGE_SUFFIX = 'pomodoro-form';

function pomodoroFormStorageKey(userId: string | undefined): string {
  return `solife.${userId ?? 'signed-out'}.${POMODORO_FORM_STORAGE_SUFFIX}`;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isPomodoroFormValues(value: unknown): value is PomodoroFormValues {
  if (!value || typeof value !== 'object') return false;
  const form = value as Partial<PomodoroFormValues>;
  return isPositiveInteger(form.focusDuration)
    && isPositiveInteger(form.shortBreakDuration)
    && isPositiveInteger(form.longBreakDuration)
    && isPositiveInteger(form.numFocuses)
    && isPositiveInteger(form.longBreakCooldown);
}

function websocketUrl(): string {
  return `${appConfig.apiUrl.replace(/^http/, 'ws')}/ws`;
}

function sendStompFrame(socket: WebSocket, command: string, headers: Record<string, string>, body = '') {
  const headerLines = Object.entries(headers).map(([key, value]) => `${key}:${value}`).join('\n');
  socket.send(`${command}\n${headerLines}\n\n${body}\0`);
}

function parseStompFrame(raw: string): { command: string; body: string } | null {
  const frame = raw.replace(/^\n+/, '').replace(/\0+$/, '');
  const separator = frame.indexOf('\n\n');
  if (separator < 0) return null;
  const header = frame.slice(0, separator);
  const commandEnd = header.indexOf('\n');
  return {
    command: commandEnd < 0 ? header : header.slice(0, commandEnd),
    body: frame.slice(separator + 2),
  };
}

function formatSeconds(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}

function formatFocusDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const remainingSeconds = safe % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${String(remainingSeconds).padStart(2, '0')}s`;
  return `${remainingSeconds}s`;
}

function isWaitingForPhase(status: PomodoroStatus | null): boolean {
  return status?.phase === 'WAITING_FOR_BREAK' || status?.phase === 'WAITING_FOR_FOCUS';
}

function optimisticStatusAllowsUpdate(
  optimistic: PomodoroStatus | null,
  next: PomodoroStatus | null,
): boolean {
  if (!optimistic) return true;
  if (!next) return !optimistic.active;
  if (next.pomodoroId !== optimistic.pomodoroId) return true;
  if (!optimistic.active) return !next.active;
  if (!next.active) return true;

  return optimistic.sessionActive === next.sessionActive
    && optimistic.sessionRunning === next.sessionRunning
    && optimistic.phase === next.phase;
}

function isBreakPhase(status: PomodoroStatus): boolean {
  return status.phase
    ? status.phase === 'BREAK' || status.phase === 'WAITING_FOR_BREAK'
    : !status.sessionActive;
}

function phaseLabel(status: PomodoroStatus): string {
  if (status.phase === 'WAITING_FOR_BREAK') return 'BREAK TIME';
  if (status.phase === 'WAITING_FOR_FOCUS') return 'WORK TIME';
  return isBreakPhase(status) ? 'BREAK TIME' : 'WORK TIME';
}

function optimisticStatus(taskId: string, form: PomodoroFormValues, config: PomodoroConfig): PomodoroStatus {
  const seconds = form.focusDuration * (config.secondsMode ? 1 : 60);
  return {
    pomodoroId: `starting-${taskId}`,
    associatedTaskId: taskId,
    active: true,
    sessionActive: true,
    sessionRunning: true,
    secondsPassedInSession: 0,
    secondsUntilNextTransition: seconds,
    currentFocusNumber: 1,
    numFocuses: form.numFocuses,
    phase: 'FOCUS',
  };
}

function durationInSeconds(value: number, config: PomodoroConfig): number {
  return Math.max(0, Math.round(config.secondsMode ? value : value * 60));
}

function optimisticToggleStatus(
  status: PomodoroStatus,
  form: PomodoroFormValues,
  config: PomodoroConfig,
): PomodoroStatus {
  if (status.phase === 'WAITING_FOR_BREAK') {
    const longBreak = status.currentFocusNumber % form.longBreakCooldown === 0;
    return {
      ...status,
      sessionActive: false,
      sessionRunning: false,
      secondsPassedInSession: 0,
      secondsUntilNextTransition: durationInSeconds(
        longBreak ? form.longBreakDuration : form.shortBreakDuration,
        config,
      ),
      phase: 'BREAK',
    };
  }

  if (status.phase === 'WAITING_FOR_FOCUS' || status.phase === 'BREAK') {
    return {
      ...status,
      sessionActive: true,
      sessionRunning: true,
      secondsPassedInSession: 0,
      secondsUntilNextTransition: durationInSeconds(form.focusDuration, config),
      currentFocusNumber: Math.min(status.numFocuses, status.currentFocusNumber + 1),
      phase: 'FOCUS',
    };
  }

  return {
    ...status,
    sessionActive: true,
    sessionRunning: !status.sessionRunning,
  };
}

function optimisticCompletedStatus(status: PomodoroStatus): PomodoroStatus {
  return {
    ...status,
    active: false,
    sessionActive: false,
    sessionRunning: false,
    secondsPassedInSession: 0,
    secondsUntilNextTransition: 0,
    completedFocusSessions: (status.completedFocusSessions ?? 0) + (status.sessionActive ? 1 : 0),
    totalFocusSeconds: (status.totalFocusSeconds ?? 0)
      + (status.sessionActive ? Math.max(0, status.secondsPassedInSession) : 0),
    phase: 'COMPLETED',
  };
}

export function PomodoroPanel({ taskId, initialStatus, onClose, onActiveChange, onStatusChange }: {
  taskId: string;
  initialStatus?: PomodoroStatus | null;
  onClose: () => void;
  onActiveChange: (active: boolean) => void;
  onStatusChange: (status: PomodoroStatus, optimistic?: boolean) => void;
}) {
  const { colors, dark } = useAppTheme();
  const { user } = useAuth();
  const pomodoroGreen = dark ? '#9BC5A3' : '#7EA88A';
  const [status, setStatus] = useState<PomodoroStatus | null>(initialStatus ?? null);
  const [config, setConfig] = useState<PomodoroConfig>(DEFAULT_CONFIG);
  const [form, setForm] = useState<PomodoroFormValues>(DEFAULT_FORM);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [statusReceivedAt, setStatusReceivedAt] = useState(0);
  const [brownNoiseEnabled, setBrownNoiseEnabled] = useState(true);
  const { ready: brownNoiseReady, start: startBrownNoise, stop: stopBrownNoise } = usePomodoroAudio();
  const onActiveChangeRef = useRef(onActiveChange);
  const onStatusChangeRef = useRef(onStatusChange);
  const lastStatusRef = useRef<PomodoroStatus | null>(initialStatus ?? null);
  const optimisticStatusRef = useRef<PomodoroStatus | null>(null);
  const statusRevisionRef = useRef(0);
  const pomodoroMutationRevisionRef = useRef(0);

  useEffect(() => { onActiveChangeRef.current = onActiveChange; }, [onActiveChange]);
  useEffect(() => { onStatusChangeRef.current = onStatusChange; }, [onStatusChange]);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(BROWN_NOISE_STORAGE_KEY).then(value => {
      if (active) setBrownNoiseEnabled(value !== 'false');
    }).catch(cause => console.warn('Could not load Pomodoro sound preference:', cause));
    return () => { active = false; };
  }, []);

  const breakPhase = Boolean(status && isBreakPhase(status));
  const focusRunning = Boolean(status?.active && status.sessionActive && status.sessionRunning && !breakPhase);

  useEffect(() => {
    if (brownNoiseReady && focusRunning && brownNoiseEnabled) startBrownNoise();
    else stopBrownNoise();
  }, [brownNoiseEnabled, brownNoiseReady, focusRunning, startBrownNoise, stopBrownNoise]);

  const commitStatus = useCallback((
    next: PomodoroStatus | null,
    announceTransition = false,
    authoritative = false,
    optimistic = false,
  ): boolean => {
    if (!optimistic && !authoritative && !optimisticStatusAllowsUpdate(optimisticStatusRef.current, next)) {
      // A live snapshot can race a request that changed this state. Keep the
      // optimistic control state until a matching authoritative read arrives.
      return false;
    }

    const previous = lastStatusRef.current;
    if (announceTransition && previous?.active && next?.active) {
      const wasBreak = isBreakPhase(previous);
      const isBreak = isBreakPhase(next);
      if (!wasBreak && isBreak) playAudioFeedback('pomodoroFocusEnded');
      if (wasBreak && !isBreak) playAudioFeedback('pomodoroBreakEnded');
    }
    if (optimistic) optimisticStatusRef.current = next;
    else if (authoritative) optimisticStatusRef.current = null;
    lastStatusRef.current = next?.active || next?.phase === 'COMPLETED' ? next : null;
    statusRevisionRef.current += 1;
    setStatusReceivedAt(Date.now());
    setStatus(next);
    if (next?.active || next?.phase === 'COMPLETED') {
      onActiveChangeRef.current(true);
      onStatusChangeRef.current(next, optimistic);
    } else {
      onActiveChangeRef.current(false);
    }
    return true;
  }, []);

  const rollbackPomodoroMutation = useCallback((
    mutationRevision: number,
    optimistic: PomodoroStatus,
    previous: PomodoroStatus | null,
  ) => {
    if (pomodoroMutationRevisionRef.current !== mutationRevision
      || lastStatusRef.current !== optimistic) return;

    commitStatus(previous, false, true);
  }, [commitStatus]);

  useEffect(() => {
    let cancelled = false;
    void api.pomodoro.config().then(next => {
      if (cancelled) return;
      setConfig(next);
      setForm(previous => previous === DEFAULT_FORM ? {
        ...previous,
        focusDuration: next.defaultFocusDuration,
        shortBreakDuration: next.defaultShortBreakDuration,
        longBreakDuration: next.defaultLongBreakDuration,
      } : previous);
    }).catch(cause => {
      // The defaults remain usable if an older backend has no config endpoint.
      console.warn('Could not load Pomodoro configuration:', cause);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(pomodoroFormStorageKey(user?.id)).then(stored => {
      if (!active || !stored) return;
      try {
        const parsed: unknown = JSON.parse(stored);
        if (isPomodoroFormValues(parsed)) setForm(parsed);
      } catch (cause) {
        console.warn('Could not read mobile Pomodoro input preferences:', cause);
      }
    }).catch(cause => console.warn('Could not read mobile Pomodoro input preferences:', cause));
    return () => { active = false; };
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;
    const revisionAtStart = statusRevisionRef.current;
    void api.pomodoro.statusForTask(taskId).then(next => {
      if (cancelled || revisionAtStart !== statusRevisionRef.current) return;
      if (next?.active) {
        commitStatus(next, false, true);
      } else if (!initialStatus?.active) {
        // Opening a new panel is not an inactive-session transition. Reporting
        // false here would make the parent immediately unmount the setup form.
        setStatus(null);
      }
    }).catch(cause => {
      // A status request is only recovery; the panel can still start a session.
      console.warn('Could not restore Pomodoro status:', cause);
    });
    return () => { cancelled = true; };
  }, [commitStatus, initialStatus?.active, taskId]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let socket: WebSocket | null = null;
    void resolveAccessToken().then(token => {
      if (cancelled || !token) return;
      socket = new WebSocket(websocketUrl());
      socket.onopen = () => {
        sendStompFrame(socket!, 'CONNECT', {
          'accept-version': '1.2',
          Authorization: `Bearer ${token}`,
          'heart-beat': '0,0',
        });
      };
      socket.onmessage = event => {
        if (typeof event.data !== 'string') return;
        const frame = parseStompFrame(event.data);
        if (!frame) return;
        if (frame.command === 'CONNECTED') {
          sendStompFrame(socket!, 'SUBSCRIBE', {
            id: `mobile-pomodoro-${taskId}`,
            ack: 'auto',
            destination: `/topic/pomodoro/${taskId}`,
          });
        }
        if (frame.command === 'MESSAGE') {
          try {
            const next = JSON.parse(frame.body) as PomodoroStatus;
            if (next.active) commitStatus(next, true);
            else {
              const previous = lastStatusRef.current;
              const accepted = commitStatus(next.phase === 'COMPLETED' ? next : null, true);
              if (accepted && next.phase === 'COMPLETED' && previous?.active) {
                playAudioFeedback('pomodoroCompleted');
              }
            }
          } catch (cause) {
            // Ignore malformed broadcasts; REST status remains the recovery path.
            console.warn('Could not parse Pomodoro WebSocket message:', cause);
          }
        }
      };
    }).catch(cause => console.warn('Could not connect to Pomodoro WebSocket:', cause));

    return () => {
      cancelled = true;
      if (socket?.readyState === 1) {
        try { sendStompFrame(socket, 'DISCONNECT', { receipt: `mobile-pomodoro-close-${taskId}` }); } catch (cause) { console.warn('Could not close Pomodoro WebSocket cleanly:', cause); }
        socket.close();
      }
    };
  }, [commitStatus, taskId]);

  const elapsedSinceStatus = statusReceivedAt ? Math.floor(Math.max(0, now - statusReceivedAt) / 1000) : 0;
  const timerAdvances = Boolean(status && (status.sessionRunning || status.phase === 'BREAK'));
  const remaining = status
    ? Math.max(0, status.secondsUntilNextTransition - (timerAdvances ? elapsedSinceStatus : 0))
    : 0;
  const waiting = isWaitingForPhase(status);
  const progress = status
    ? (() => {
        const passed = status.secondsPassedInSession + (timerAdvances ? elapsedSinceStatus : 0);
        const total = passed + remaining;
        return total > 0 ? Math.min(1, passed / total) : 0;
      })()
    : 0;

  const setFormValue = (key: keyof PomodoroFormValues, text: string) => {
    const value = Number(text.replace(/[^0-9]/g, '')) || 0;
    const next = { ...form, [key]: value };
    setForm(next);
    if (isPomodoroFormValues(next)) {
      void AsyncStorage.setItem(pomodoroFormStorageKey(user?.id), JSON.stringify(next)).catch(cause => {
        console.warn('Could not save mobile Pomodoro input preferences:', cause);
      });
    }
  };

  const refreshStatus = useCallback(async (
    preserveActiveWhenMissing = false,
    authoritative = false,
  ) => {
    const revisionAtStart = statusRevisionRef.current;
    const next = await api.pomodoro.statusForTask(taskId);
    if (revisionAtStart !== statusRevisionRef.current) return;
    if (next?.active) {
      commitStatus(next, false, authoritative);
    } else if (!preserveActiveWhenMissing) {
      commitStatus(null, false, authoritative);
    }
  }, [commitStatus, taskId]);

  useEffect(() => {
    if (!status?.active) return;
    const timer = setInterval(() => {
      void refreshStatus().catch(cause => console.warn('Could not recover Pomodoro status:', cause));
    }, 10_000);
    return () => clearInterval(timer);
  }, [refreshStatus, status?.active]);

  const start = useCallback(() => {
    if (Object.values(form).some(value => value <= 0)) {
      setError('All focus and break values must be positive.');
      return;
    }
    const previousStatus = lastStatusRef.current?.active ? lastStatusRef.current : null;
    const nextStatus = optimisticStatus(taskId, form, config);
    const mutationRevision = ++pomodoroMutationRevisionRef.current;
    commitStatus(nextStatus, false, false, true);
    setError(null);

    void api.pomodoro.start(taskId, { ...form, secondsMode: config.secondsMode })
      .then(() => {
        if (pomodoroMutationRevisionRef.current !== mutationRevision) return;
        void refreshStatus(true, true).catch(cause => console.warn('Could not refresh Pomodoro after starting:', cause));
      })
      .catch(cause => {
        console.error('Could not start Pomodoro:', cause);
        rollbackPomodoroMutation(mutationRevision, nextStatus, previousStatus);
        if (pomodoroMutationRevisionRef.current === mutationRevision) setError(GENERIC_ERROR_MESSAGE);
      });
  }, [commitStatus, config, form, refreshStatus, rollbackPomodoroMutation, taskId]);

  const runAction = useCallback((
    previousStatus: PomodoroStatus,
    nextStatus: PomodoroStatus,
    action: () => Promise<unknown>,
  ) => {
    const mutationRevision = ++pomodoroMutationRevisionRef.current;
    commitStatus(nextStatus, false, false, true);
    setError(null);

    void action()
      .then(() => {
        if (pomodoroMutationRevisionRef.current !== mutationRevision) return;
        void refreshStatus(true, true).catch(cause => console.warn('Could not refresh Pomodoro after updating:', cause));
      })
      .catch(cause => {
        console.error('Could not update Pomodoro:', cause);
        rollbackPomodoroMutation(mutationRevision, nextStatus, previousStatus);
        if (pomodoroMutationRevisionRef.current === mutationRevision) setError(GENERIC_ERROR_MESSAGE);
      });
  }, [commitStatus, refreshStatus, rollbackPomodoroMutation]);

  const stop = useCallback(() => {
    const previousStatus = lastStatusRef.current?.active ? lastStatusRef.current : null;
    if (!previousStatus) return;

    const nextStatus = optimisticCompletedStatus(previousStatus);
    const mutationRevision = ++pomodoroMutationRevisionRef.current;
    commitStatus(nextStatus, false, false, true);
    setError(null);

    void api.pomodoro.end(taskId)
      .then(completedStatus => {
        if (pomodoroMutationRevisionRef.current !== mutationRevision) return;
        if (lastStatusRef.current === nextStatus) {
          commitStatus(completedStatus, false, true);
        } else {
          void refreshStatus(true, true).catch(cause => console.warn('Could not refresh Pomodoro after stopping:', cause));
        }
      })
      .catch(cause => {
        console.error('Could not stop Pomodoro:', cause);
        rollbackPomodoroMutation(mutationRevision, nextStatus, previousStatus);
        if (pomodoroMutationRevisionRef.current === mutationRevision) setError(GENERIC_ERROR_MESSAGE);
      });
  }, [commitStatus, refreshStatus, rollbackPomodoroMutation, taskId]);

  const toggle = useCallback(() => {
    const previousStatus = lastStatusRef.current?.active ? lastStatusRef.current : null;
    if (!previousStatus) return;

    const nextStatus = optimisticToggleStatus(previousStatus, form, config);
    runAction(
      previousStatus,
      nextStatus,
      isWaitingForPhase(previousStatus)
        ? () => api.pomodoro.startNextPhase(taskId)
        : previousStatus.sessionRunning ? () => api.session.pause(taskId) : () => api.session.resume(taskId),
    );
  }, [config, form, runAction, taskId]);

  const finishBreak = useCallback(() => {
    const previousStatus = lastStatusRef.current?.active ? lastStatusRef.current : null;
    if (!previousStatus || previousStatus.phase !== 'BREAK') return;

    runAction(
      previousStatus,
      optimisticToggleStatus(previousStatus, form, config),
      () => api.pomodoro.finishBreakEarly(taskId),
    );
  }, [config, form, runAction, taskId]);

  const toggleBrownNoise = useCallback(() => {
    setBrownNoiseEnabled(previous => {
      const next = !previous;
      void AsyncStorage.setItem(BROWN_NOISE_STORAGE_KEY, String(next)).catch(cause => {
        console.warn('Could not save Pomodoro sound preference:', cause);
      });
      return next;
    });
  }, []);

  const controls = status ? (
    <View style={styles.controls}>
      {(waiting || !breakPhase) && (
        <AppButton
          compact
          variant={waiting
            ? status.phase === 'WAITING_FOR_BREAK' ? 'success' : 'primary'
            : 'secondary'}
          style={waiting && status.phase === 'WAITING_FOR_BREAK'
            ? { backgroundColor: pomodoroGreen, borderColor: pomodoroGreen }
            : undefined}
          icon={!waiting && status.sessionRunning ? 'pause' : 'play'}
          label={waiting ? (status.phase === 'WAITING_FOR_BREAK' ? 'Start break' : 'Start focus') : status.sessionRunning ? 'Pause' : 'Resume'}
          onPress={toggle}
        />
      )}
      {status.phase === 'BREAK' && (
        <AppButton compact variant="primary" icon="play-forward" label="Start focus" onPress={finishBreak} />
      )}
      <AppButton
        compact
        variant="secondary"
        icon={brownNoiseEnabled ? 'volume-high-outline' : 'volume-mute-outline'}
        label={brownNoiseEnabled ? 'Mute focus audio' : 'Play focus audio'}
        onPress={toggleBrownNoise}
      />
      <AppButton compact variant="danger" icon="stop" label="Stop" onPress={stop} />
    </View>
  ) : null;

  if (status?.phase === 'COMPLETED') {
    return (
      <ModalSheet visible title="Focus timer" onClose={onClose}>
        <View style={styles.completed}>
          <Ionicons name="checkmark-circle-outline" size={30} color={colors.success} />
          <AppText variant="heading">Pomodoro complete</AppText>
          <AppText color="muted">
            {formatFocusDuration(status.totalFocusSeconds ?? status.secondsPassedInSession)} focused · {'\n'}
            {status.completedFocusSessions ?? status.currentFocusNumber} of {status.numFocuses} sessions completed
          </AppText>
          <AppButton label="Dismiss" variant="secondary" onPress={() => {
            onActiveChangeRef.current(false);
          }} />
        </View>
      </ModalSheet>
    );
  }

  if (!status?.active) {
    return (
      <ModalSheet visible title="Focus timer" onClose={onClose}>
        <View style={styles.setup}>
          <View style={styles.setupHeading}>
            <Ionicons name="timer-outline" size={22} color={colors.accent} />
            <View style={styles.grow}>
              <AppText variant="heading">Set up a focus block</AppText>
              <AppText color="muted">Choose how this focus block should run.</AppText>
            </View>
          </View>
          <View style={styles.options}>
            {([
              ['focusDuration', `Focus (${config.durationUnit})`],
              ['shortBreakDuration', `Short break (${config.durationUnit})`],
              ['longBreakDuration', `Long break (${config.durationUnit})`],
              ['numFocuses', 'Sessions'],
            ] as const).map(([key, label]) => (
              <View key={key} style={styles.option}>
                <AppInput label={label} value={String(form[key])} onChangeText={text => setFormValue(key, text)} keyboardType="number-pad" />
              </View>
            ))}
          </View>
          <AppButton label="Start focus" icon="play" onPress={start} />
          {error && <AppText color="danger">{error}</AppText>}
        </View>
      </ModalSheet>
    );
  }

  return (
    <View style={styles.activePanel}>
      <View style={styles.activeInfo}>
        <View style={styles.grow}>
          {waiting ? (
            <View style={styles.stackedPhaseLabel}>
              {phaseLabel(status).split(' ').map(word => (
                <AppText
                  key={word}
                  variant="title"
                  color={breakPhase ? 'default' : 'accent'}
                  style={breakPhase ? { color: pomodoroGreen } : undefined}
                >{word}</AppText>
              ))}
            </View>
          ) : (
            <>
              <AppText
                variant="caption"
                color={breakPhase ? 'default' : 'accent'}
                style={breakPhase ? { color: pomodoroGreen } : undefined}
              >{phaseLabel(status)}</AppText>
              <AppText variant="title">{formatSeconds(remaining)}</AppText>
            </>
          )}
        </View>
        <View style={styles.dots}>
          {Array.from({ length: status.numFocuses }).map((_, index) => (
            <View key={index} style={[styles.dot, { backgroundColor: index < status.currentFocusNumber ? colors.accent : colors.accentSoft }]} />
          ))}
        </View>
      </View>
      <View style={[styles.track, { backgroundColor: breakPhase ? `${pomodoroGreen}28` : colors.accentSoft }]}>
        <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: breakPhase ? pomodoroGreen : colors.accent }]} />
      </View>
      {controls}
      {error && <AppText color="danger">{error}</AppText>}
    </View>
  );
}

const styles = StyleSheet.create({
  completed: { alignItems: 'center', gap: 10, paddingVertical: 18 },
  setup: { gap: 14, paddingTop: 4, paddingBottom: 14 },
  setupHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  grow: { flex: 1, gap: 3 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  option: { width: '48%' },
  activePanel: { gap: 13, paddingTop: 2, paddingHorizontal: 13, paddingBottom: 14 },
  activeInfo: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stackedPhaseLabel: { gap: 0 },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },
});
