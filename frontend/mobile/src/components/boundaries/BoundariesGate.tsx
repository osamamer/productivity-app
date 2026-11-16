import { PropsWithChildren, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, PermissionsAndroid, Platform, View } from 'react-native';

import { useAppTheme } from '@/providers/ThemeProvider';
import { Boundaries } from '@/services/boundaries';
import { BoundariesLock } from './BoundariesLock';
import { BoundariesSetup } from './BoundariesSetup';

// A real trip away (Home, app switch, screen off) takes at least this long. Shorter non-active
// blips happen when a native Modal opens, and must not re-lock mid-dialog.
const SPURIOUS_BACKGROUND_MS = 1000;

type GateState = 'loading' | 'setup' | 'locked' | 'open';

/** Shows setup on first use, then the lock screen on every entry and every return from the background. */
export function BoundariesGate({ children }: PropsWithChildren) {
  const { colors } = useAppTheme();
  const [state, setState] = useState<GateState>('loading');
  const backgroundedAt = useRef<number | null>(null);

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
      setState((await Boundaries?.hasPasswordsSet()) ? 'locked' : 'setup');
    })();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', next => {
      if (next !== 'active') {
        backgroundedAt.current ??= Date.now();
        return;
      }
      const leftAt = backgroundedAt.current;
      backgroundedAt.current = null;
      if (leftAt === null || Date.now() - leftAt < SPURIOUS_BACKGROUND_MS) return;
      setState(current => (current === 'open' ? 'locked' : current));
    });
    return () => subscription.remove();
  }, []);

  if (state === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (state === 'setup') return <BoundariesSetup onDone={() => setState('open')} />;
  if (state === 'locked') return <BoundariesLock onUnlocked={() => setState('open')} />;
  return children;
}
