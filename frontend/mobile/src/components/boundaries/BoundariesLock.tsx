import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { boundariesUnlockRemaining } from '@/lib/boundariesSession';
import { useAppTheme } from '@/providers/ThemeProvider';
import { Boundaries } from '@/services/boundaries';
import { useBoundariesAccess } from './BoundariesGate';
import { PasswordPrompt } from './PasswordPrompt';

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** Whether Boundaries can be changed right now, with Unlock (password, then ten seconds) or Lock now. */
export function BoundariesLockCard() {
  const { colors } = useAppTheme();
  const access = useBoundariesAccess();
  const [prompting, setPrompting] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const remaining = boundariesUnlockRemaining(now);

  useEffect(() => {
    if (!access.editable) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [access.editable]);

  return (
    <Card style={styles.card}>
      <View style={[styles.badge, { backgroundColor: colors.accentSoft }]}>
        <Ionicons name={access.editable ? 'lock-open-outline' : 'lock-closed-outline'} size={20} color={colors.accent} />
      </View>
      <View style={styles.copy}>
        <AppText variant="label">{access.editable ? 'Unlocked' : 'Locked'}</AppText>
        <AppText variant="caption" color="muted">
          {access.editable
            ? `Changes allowed · locks again in ${formatCountdown(remaining)}`
            : 'Look at everything freely. Unlock to change anything.'}
        </AppText>
      </View>
      {access.editable
        ? <AppButton compact variant="secondary" label="Lock now" onPress={access.lock} />
        : <AppButton compact label="Unlock" onPress={() => setPrompting(true)} />}
      <PasswordPrompt
        visible={prompting}
        title="Unlock Boundaries"
        message="Changes stay allowed for ten minutes."
        placeholder="Unlock password"
        submitLabel="Unlock"
        incorrectMessage="Incorrect password."
        onCancel={() => setPrompting(false)}
        verify={async password => Boolean(await Boundaries?.verifyUnlockPassword(password))}
        onConfirmed={async () => {
          setPrompting(false);
          setNow(Date.now());
          access.unlock();
        }}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  badge: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 2 },
});
