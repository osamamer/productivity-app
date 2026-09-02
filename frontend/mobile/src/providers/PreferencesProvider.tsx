import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useAuth } from './AuthProvider';

type PreferencesValue = {
  showCompletedTasks: boolean;
  setShowCompletedTasks: (value: boolean) => void;
};

const PreferencesContext = createContext<PreferencesValue | null>(null);

function storageKey(userId: string | undefined): string {
  return `solife.${userId ?? 'signed-out'}.show-completed-tasks`;
}

export function PreferencesProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const [showCompletedTasks, setShowCompletedTasksState] = useState(true);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(storageKey(user?.id)).then(value => {
      if (active) setShowCompletedTasksState(value === null || value !== 'false');
    }).catch(cause => console.warn('Could not load mobile task preferences:', cause));
    return () => { active = false; };
  }, [user?.id]);

  const setShowCompletedTasks = useCallback((value: boolean) => {
    setShowCompletedTasksState(value);
    void AsyncStorage.setItem(storageKey(user?.id), String(value)).catch(cause => {
      console.warn('Could not save mobile task preferences:', cause);
    });
  }, [user?.id]);

  const value = useMemo(() => ({ showCompletedTasks, setShowCompletedTasks }), [setShowCompletedTasks, showCompletedTasks]);
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesValue {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error('usePreferences must be used inside PreferencesProvider');
  return value;
}
