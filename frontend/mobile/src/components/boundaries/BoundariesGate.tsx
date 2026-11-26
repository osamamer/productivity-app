import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, AppState, PermissionsAndroid, Platform, View } from 'react-native';

import { boundariesUnlockRemaining, clearBoundariesSession, unlockBoundaries } from '@/lib/boundariesSession';
import { useAppTheme } from '@/providers/ThemeProvider';
import { Boundaries } from '@/services/boundaries';
import { BoundariesSetup } from './BoundariesSetup';

interface BoundariesAccess {
  /** Whether changes are allowed: the unlock password was entered less than ten minutes ago. */
  editable: boolean;
  unlock: () => void;
  lock: () => void;
}

const BoundariesAccessContext = createContext<BoundariesAccess>({ editable: false, unlock: () => {}, lock: () => {} });

export function useBoundariesAccess(): BoundariesAccess {
  return useContext(BoundariesAccessContext);
}

/**
 * Boundaries can always be looked at; changing them needs the unlock password, which lasts ten
 * minutes including navigation and time in the background. Without passwords yet, sets them up first.
 */
export function BoundariesGate({ children }: PropsWithChildren) {
  const { colors } = useAppTheme();
  const [state, setState] = useState<'loading' | 'setup' | 'ready'>('loading');
  const [editable, setEditable] = useState(() => boundariesUnlockRemaining() > 0);

  const unlock = useCallback(() => {
    unlockBoundaries();
    setEditable(true);
  }, []);
  const lock = useCallback(() => {
    clearBoundariesSession();
    setEditable(false);
  }, []);

  useEffect(() => {
    void (async () => {
      if (Platform.OS === 'android' && Platform.Version >= 33) {
        try {
          await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
        } catch (cause) {
          // Non-fatal: the status notification just won't be visible.
          console.warn('Notification permission request failed:', cause);
        }
      }
      setState((await Boundaries?.hasPasswordsSet()) ? 'ready' : 'setup');
    })();
  }, []);

  useEffect(() => {
    if (!editable) return;
    const lockIfExpired = () => {
      if (boundariesUnlockRemaining() === 0) setEditable(false);
    };
    const timer = setTimeout(lockIfExpired, boundariesUnlockRemaining());
    const subscription = AppState.addEventListener('change', next => {
      if (next === 'active') lockIfExpired();
    });
    return () => { clearTimeout(timer); subscription.remove(); };
  }, [editable]);

  const access = useMemo(() => ({ editable, unlock, lock }), [editable, unlock, lock]);

  if (state === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (state === 'setup') return <BoundariesSetup onDone={() => { unlock(); setState('ready'); }} />;
  return <BoundariesAccessContext.Provider value={access}>{children}</BoundariesAccessContext.Provider>;
}
