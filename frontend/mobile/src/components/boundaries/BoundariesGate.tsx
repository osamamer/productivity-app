import { PropsWithChildren, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, PermissionsAndroid, Platform, View } from 'react-native';

import { boundariesUnlockRemaining, unlockBoundaries } from '@/lib/boundariesSession';
import { useAppTheme } from '@/providers/ThemeProvider';
import { Boundaries } from '@/services/boundaries';
import { BoundariesLock } from './BoundariesLock';
import { BoundariesSetup } from './BoundariesSetup';

type GateState = 'loading' | 'setup' | 'locked' | 'open';

/** Password authorization lasts ten minutes, including navigation and time in the background. */
export function BoundariesGate({ children }: PropsWithChildren) {
  const { colors } = useAppTheme();
  const [state, setState] = useState<GateState>('loading');
  const open = () => {
    unlockBoundaries();
    setState('open');
  };

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
      setState((await Boundaries?.hasPasswordsSet()) ? boundariesUnlockRemaining() > 0 ? 'open' : 'locked' : 'setup');
    })();
  }, []);

  useEffect(() => {
    if (state !== 'open') return;
    const lockIfExpired = () => {
      if (boundariesUnlockRemaining() === 0) setState('locked');
    };
    const timer = setTimeout(lockIfExpired, boundariesUnlockRemaining());
    const subscription = AppState.addEventListener('change', next => {
      if (next === 'active') lockIfExpired();
    });
    return () => { clearTimeout(timer); subscription.remove(); };
  }, [state]);

  if (state === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (state === 'setup') return <BoundariesSetup onDone={open} />;
  if (state === 'locked') return <BoundariesLock onUnlocked={open} />;
  return children;
}
