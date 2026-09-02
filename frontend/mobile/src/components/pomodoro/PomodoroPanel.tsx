import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { appConfig } from '@/lib/config';
import { GENERIC_ERROR_MESSAGE } from '@/lib/errors';
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

function isWaitingForPhase(status: PomodoroStatus | null): boolean {
  return status?.phase === 'WAITING_FOR_BREAK' || status?.phase === 'WAITING_FOR_FOCUS';
}

function isBreakPhase(status: PomodoroStatus): boolean {
  return status.phase
    ? status.phase === 'BREAK' || status.phase === 'WAITING_FOR_BREAK'
    : !status.sessionActive;
}

function phaseLabel(status: PomodoroStatus): string {
  if (status.phase === 'WAITING_FOR_BREAK') return 'Break ready';
  if (status.phase === 'WAITING_FOR_FOCUS') return 'Focus ready';
  return isBreakPhase(status) ? 'Break' : 'Focus';
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

export function PomodoroPanel({ taskId, initialStatus, onClose, onActiveChange, onStatusChange }: {
  taskId: string;
  initialStatus?: PomodoroStatus | null;
  onClose: () => void;
  onActiveChange: (active: boolean) => void;
  onStatusChange: (status: PomodoroStatus) => void;
}) {
  const { colors } = useAppTheme();
  const [status, setStatus] = useState<PomodoroStatus | null>(initialStatus ?? null);
  const [config, setConfig] = useState<PomodoroConfig>(DEFAULT_CONFIG);
  const [form, setForm] = useState<PomodoroFormValues>(DEFAULT_FORM);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [statusReceivedAt, setStatusReceivedAt] = useState(0);
  const onActiveChangeRef = useRef(onActiveChange);
  const onStatusChangeRef = useRef(onStatusChange);

  useEffect(() => { onActiveChangeRef.current = onActiveChange; }, [onActiveChange]);
  useEffect(() => { onStatusChangeRef.current = onStatusChange; }, [onStatusChange]);

  const commitStatus = useCallback((next: PomodoroStatus | null) => {
    setStatusReceivedAt(Date.now());
    setStatus(next);
    if (next?.active) {
      onActiveChangeRef.current(true);
      onStatusChangeRef.current(next);
    } else {
      onActiveChangeRef.current(false);
    }
  }, []);

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
    let cancelled = false;
    void api.pomodoro.statusForTask(taskId).then(next => {
      if (cancelled) return;
      if (next?.active) {
        commitStatus(next);
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
            if (next.active) commitStatus(next);
            else commitStatus(null);
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
  const breakPhase = Boolean(status && isBreakPhase(status));
  const waiting = isWaitingForPhase(status);
  const progress = status
    ? (() => {
        const passed = status.secondsPassedInSession + (timerAdvances ? elapsedSinceStatus : 0);
        const total = passed + remaining;
        return total > 0 ? Math.min(1, passed / total) : 0;
      })()
    : 0;

  const setFormValue = (key: keyof PomodoroFormValues, text: string) => {
    setForm(previous => ({ ...previous, [key]: Number(text.replace(/[^0-9]/g, '')) || 0 }));
  };

  const refreshStatus = useCallback(async (preserveActiveWhenMissing = false) => {
    const next = await api.pomodoro.statusForTask(taskId);
    if (next?.active) {
      commitStatus(next);
    } else if (!preserveActiveWhenMissing) {
      commitStatus(null);
    }
  }, [commitStatus, taskId]);

  useEffect(() => {
    if (!status?.active) return;
    const timer = setInterval(() => {
      void refreshStatus().catch(cause => console.warn('Could not recover Pomodoro status:', cause));
    }, 10_000);
    return () => clearInterval(timer);
  }, [refreshStatus, status?.active]);

  async function start() {
    if (Object.values(form).some(value => value <= 0)) {
      setError('All focus and break values must be positive.');
      return;
    }
    setActionLoading(true); setError(null);
    try {
      await api.pomodoro.start(taskId, { ...form, secondsMode: config.secondsMode });
      commitStatus(optimisticStatus(taskId, form, config));
      await refreshStatus(true).catch(cause => console.warn('Could not refresh Pomodoro after starting:', cause));
    } catch (cause) {
      console.error('Could not start Pomodoro:', cause);
      setError(GENERIC_ERROR_MESSAGE);
    } finally { setActionLoading(false); }
  }

  const runAction = useCallback(async (action: () => Promise<void>) => {
    setActionLoading(true); setError(null);
    try {
      await action();
      await refreshStatus();
    } catch (cause) {
      console.error('Could not update Pomodoro:', cause);
      setError(GENERIC_ERROR_MESSAGE);
    } finally { setActionLoading(false); }
  }, [refreshStatus]);

  const stop = useCallback(() => {
    void runAction(async () => {
      await api.pomodoro.end(taskId);
      commitStatus(null);
    });
  }, [commitStatus, runAction, taskId]);

  const controls = status ? (
    <View style={styles.controls}>
      {(waiting || !breakPhase) && (
        <AppButton
          compact
          variant="secondary"
          icon={!waiting && status.sessionRunning ? 'pause' : 'play'}
          label={waiting ? (status.phase === 'WAITING_FOR_BREAK' ? 'Start break' : 'Start focus') : status.sessionRunning ? 'Pause' : 'Resume'}
          loading={actionLoading}
          onPress={() => void runAction(
            waiting
              ? () => api.pomodoro.startNextPhase(taskId)
              : status.sessionRunning ? () => api.session.pause(taskId) : () => api.session.resume(taskId),
          )}
        />
      )}
      {status.phase === 'BREAK' && (
        <AppButton compact variant="secondary" icon="play-forward" label="Start focus" loading={actionLoading} onPress={() => void runAction(() => api.pomodoro.finishBreakEarly(taskId))} />
      )}
      <AppButton compact variant="danger" icon="stop" label="Stop" loading={actionLoading} onPress={stop} />
    </View>
  ) : null;

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
                <AppInput label={label} value={String(form[key])} onChangeText={text => setFormValue(key, text)} keyboardType="number-pad" editable={!actionLoading} />
              </View>
            ))}
          </View>
          <AppButton label={actionLoading ? 'Starting…' : 'Start focus'} icon="play" loading={actionLoading} onPress={() => void start()} />
          {error && <AppText color="danger">{error}</AppText>}
        </View>
      </ModalSheet>
    );
  }

  return (
    <View style={styles.activePanel}>
      <View style={styles.activeInfo}>
        <View style={styles.grow}>
          <AppText variant="caption" color={breakPhase ? 'success' : 'accent'}>{phaseLabel(status)}</AppText>
          <AppText variant="title">{waiting ? 'Ready' : formatSeconds(remaining)}</AppText>
        </View>
        <View style={styles.dots}>
          {Array.from({ length: status.numFocuses }).map((_, index) => (
            <View key={index} style={[styles.dot, { backgroundColor: index < status.currentFocusNumber ? colors.accent : colors.accentSoft }]} />
          ))}
        </View>
      </View>
      <View style={[styles.track, { backgroundColor: breakPhase ? `${colors.success}28` : colors.accentSoft }]}>
        <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: breakPhase ? colors.success : colors.accent }]} />
      </View>
      {controls}
      {error && <AppText color="danger">{error}</AppText>}
    </View>
  );
}

const styles = StyleSheet.create({
  setup: { gap: 14, paddingTop: 4, paddingBottom: 14 },
  setupHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  grow: { flex: 1, gap: 3 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  option: { width: '48%' },
  activePanel: { gap: 13, paddingTop: 2, paddingHorizontal: 13, paddingBottom: 14 },
  activeInfo: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },
});
