import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { setAudioFeedbackEnabled } from '@/lib/audioFeedback';
import { useAuth } from './AuthProvider';

type PreferencesValue = {
  showCompletedTasks: boolean;
  setShowCompletedTasks: (value: boolean) => void;
  showClosedMentalThreads: boolean;
  setShowClosedMentalThreads: (value: boolean) => void;
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

export function PreferencesProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const [showCompletedTasks, setShowCompletedTasksState] = useState(true);
  const [showClosedMentalThreads, setShowClosedMentalThreadsState] = useState(false);
  const [soundEffectsEnabled, setSoundEffectsEnabledState] = useState(true);

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
    soundEffectsEnabled,
    setSoundEffectsEnabled,
  }), [setShowClosedMentalThreads, setShowCompletedTasks, setSoundEffectsEnabled, showClosedMentalThreads, showCompletedTasks, soundEffectsEnabled]);
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesValue {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error('usePreferences must be used inside PreferencesProvider');
  return value;
}
