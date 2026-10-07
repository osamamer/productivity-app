import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { setAudioFeedbackEnabled } from '@/lib/audioFeedback';
import { useAuth } from './AuthProvider';

type PreferencesValue = {
  showCompletedTasks: boolean;
  setShowCompletedTasks: (value: boolean) => void;
  showClosedMentalThreads: boolean;
  setShowClosedMentalThreads: (value: boolean) => void;
  showTodaySnapshot: boolean;
  setShowTodaySnapshot: (value: boolean) => void;
  showTodayEvents: boolean;
  setShowTodayEvents: (value: boolean) => void;
  homeDisplayPreferencesReady: boolean;
  soundEffectsEnabled: boolean;
  setSoundEffectsEnabled: (value: boolean) => void;
};

const PreferencesContext = createContext<PreferencesValue | null>(null);

function storageKey(userId: string | undefined): string {
  return `solife.${userId ?? 'signed-out'}.show-completed-tasks`;
}

function soundEffectsStorageKey(userId: string | undefined): string {
  return `solife.${userId ?? 'signed-out'}.sound-effects`;
}

function showClosedMentalThreadsStorageKey(userId: string | undefined): string {
  return `solife.${userId ?? 'signed-out'}.show-closed-mental-threads`;
}

function showTodaySnapshotStorageKey(userId: string | undefined): string {
  return `solife.${userId ?? 'signed-out'}.show-today-snapshot`;
}

function showTodayEventsStorageKey(userId: string | undefined): string {
  return `solife.${userId ?? 'signed-out'}.show-today-events`;
}

export function PreferencesProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const todaySnapshotKey = showTodaySnapshotStorageKey(user?.id);
  const todayEventsKey = showTodayEventsStorageKey(user?.id);
  const [showCompletedTasks, setShowCompletedTasksState] = useState(true);
  const [showClosedMentalThreads, setShowClosedMentalThreadsState] = useState(false);
  const [showTodaySnapshot, setShowTodaySnapshotState] = useState(true);
  const [showTodayEvents, setShowTodayEventsState] = useState(true);
  const [loadedHomeDisplayPreferencesKey, setLoadedHomeDisplayPreferencesKey] = useState<string | null>(null);
  const [soundEffectsEnabled, setSoundEffectsEnabledState] = useState(true);

  useEffect(() => {
    let active = true;
    void AsyncStorage.multiGet([todaySnapshotKey, todayEventsKey]).then(values => {
      if (!active) return;
      setShowTodaySnapshotState(values[0]?.[1] !== 'false');
      setShowTodayEventsState(values[1]?.[1] !== 'false');
      setLoadedHomeDisplayPreferencesKey(todaySnapshotKey);
    }).catch(cause => {
      console.warn('Could not load mobile home display preferences:', cause);
      if (!active) return;
      setShowTodaySnapshotState(true);
      setShowTodayEventsState(true);
      setLoadedHomeDisplayPreferencesKey(todaySnapshotKey);
    });
    return () => { active = false; };
  }, [todayEventsKey, todaySnapshotKey]);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(storageKey(user?.id)).then(value => {
      if (active) setShowCompletedTasksState(value === null || value !== 'false');
    }).catch(cause => console.warn('Could not load mobile task preferences:', cause));
    return () => { active = false; };
  }, [user?.id]);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(showClosedMentalThreadsStorageKey(user?.id)).then(value => {
      if (active) setShowClosedMentalThreadsState(value === 'true');
    }).catch(cause => console.warn('Could not load mobile mental thread preferences:', cause));
    return () => { active = false; };
  }, [user?.id]);

  useEffect(() => {
    let active = true;
    setAudioFeedbackEnabled(true);
    void AsyncStorage.getItem(soundEffectsStorageKey(user?.id)).then(value => {
      if (!active) return;
      const enabled = value !== 'false';
      setSoundEffectsEnabledState(enabled);
      setAudioFeedbackEnabled(enabled);
    }).catch(cause => console.warn('Could not load mobile sound effects preference:', cause));
    return () => { active = false; };
  }, [user?.id]);

  const setShowCompletedTasks = useCallback((value: boolean) => {
    setShowCompletedTasksState(value);
    void AsyncStorage.setItem(storageKey(user?.id), String(value)).catch(cause => {
      console.warn('Could not save mobile task preferences:', cause);
    });
  }, [user?.id]);

  const setShowClosedMentalThreads = useCallback((value: boolean) => {
    setShowClosedMentalThreadsState(value);
    void AsyncStorage.setItem(showClosedMentalThreadsStorageKey(user?.id), String(value)).catch(cause => {
      console.warn('Could not save mobile mental thread preferences:', cause);
    });
  }, [user?.id]);

  const setShowTodaySnapshot = useCallback((value: boolean) => {
    setShowTodaySnapshotState(value);
    void AsyncStorage.setItem(todaySnapshotKey, String(value)).catch(cause => {
      console.warn('Could not save mobile Today at a glance preference:', cause);
    });
  }, [todaySnapshotKey]);

  const setShowTodayEvents = useCallback((value: boolean) => {
    setShowTodayEventsState(value);
    void AsyncStorage.setItem(todayEventsKey, String(value)).catch(cause => {
      console.warn('Could not save mobile Today events preference:', cause);
    });
  }, [todayEventsKey]);

  const setSoundEffectsEnabled = useCallback((value: boolean) => {
    setSoundEffectsEnabledState(value);
    setAudioFeedbackEnabled(value);
    void AsyncStorage.setItem(soundEffectsStorageKey(user?.id), String(value)).catch(cause => {
      console.warn('Could not save mobile sound effects preference:', cause);
    });
  }, [user?.id]);

  const value = useMemo(() => ({
    showCompletedTasks,
    setShowCompletedTasks,
    showClosedMentalThreads,
    setShowClosedMentalThreads,
    showTodaySnapshot,
    setShowTodaySnapshot,
    showTodayEvents,
    setShowTodayEvents,
    homeDisplayPreferencesReady: loadedHomeDisplayPreferencesKey === todaySnapshotKey,
    soundEffectsEnabled,
    setSoundEffectsEnabled,
  }), [loadedHomeDisplayPreferencesKey, setShowClosedMentalThreads, setShowCompletedTasks, setSoundEffectsEnabled, setShowTodayEvents, setShowTodaySnapshot, showClosedMentalThreads, showCompletedTasks, showTodayEvents, showTodaySnapshot, soundEffectsEnabled, todaySnapshotKey]);
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesValue {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error('usePreferences must be used inside PreferencesProvider');
  return value;
}
