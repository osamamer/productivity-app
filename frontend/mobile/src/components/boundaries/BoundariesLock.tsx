import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { useAppTheme } from '@/providers/ThemeProvider';
import { Boundaries } from '@/services/boundaries';
import { PasswordField } from './PasswordField';
import { usePasswordWait } from './usePasswordWait';

/**
 * Asks for the unlock password, then a ten second wait, every time Boundaries is opened or
 * brought back to the foreground. Enforcement keeps running in the background whether or not
 * this is showing.
 */
export function BoundariesLock({ onUnlocked }: { onUnlocked: () => void }) {
  const { colors } = useAppTheme();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const wait = usePasswordWait();

  const submit = async () => {
    if (wait.waiting) return;
    if (!password) return setError('Enter your unlock password.');
    setBusy(true);
    setError(null);
    try {
      if (await Boundaries?.verifyUnlockPassword(password)) {
        setPassword('');
        wait.start(onUnlocked);
      } else {
        setError('Incorrect password.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen back contentStyle={styles.content}>
      <View style={[styles.badge, { backgroundColor: colors.accentSoft }]}>
        <Ionicons name="lock-closed-outline" size={30} color={colors.accent} />
      </View>
      <AppText variant="display" style={styles.center}>Boundaries are locked</AppText>
      <AppText color="muted" style={styles.center}>Enter your unlock password, then wait ten seconds, to view or change them.</AppText>
      <Card style={{ gap: 12 }}>
        <PasswordField
          value={password}
          onChangeText={setPassword}
          placeholder="Unlock password"
          autoFocus
          editable={!busy && !wait.waiting}
          onSubmitEditing={() => void submit()}
        />
        {error ? <AppText variant="caption" color="danger">{error}</AppText> : null}
        <AppButton
          label={wait.waiting ? `Unlocking in ${wait.remaining} s` : 'Unlock'}
          loading={busy}
          disabled={wait.waiting}
          onPress={() => void submit()}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 12 },
  badge: { width: 64, height: 64, borderRadius: 22, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  center: { textAlign: 'center' },
});
