import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { PasswordField } from '@/components/boundaries/PasswordField';
import { AppButton } from '@/components/ui/AppButton';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { usePasswordWait } from '@/components/boundaries/usePasswordWait';
import { Boundaries } from '@/services/boundaries';

const MIN_LENGTH = 8;

/** Changing either password first needs the current master password and a ten second wait. */
export default function BoundaryPasswords() {
  const [master, setMaster] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [newUnlock, setNewUnlock] = useState('');
  const [newMaster, setNewMaster] = useState('');
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const wait = usePasswordWait();

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setMessage(null);
    try {
      await action();
    } catch (cause) {
      console.error('Could not change a Boundaries password:', cause);
      setMessage({ text: cause instanceof Error ? cause.message : 'Could not update the password.', error: true });
    } finally {
      setBusy(false);
    }
  };

  const verify = () => run(async () => {
    if (wait.waiting) return;
    if (await Boundaries?.verifyMasterPassword(master)) wait.start(() => setUnlocked(true));
    else setMessage({ text: 'Master password incorrect.', error: true });
  });

  const saveUnlock = () => run(async () => {
    if (newUnlock.length < MIN_LENGTH) return setMessage({ text: 'The new unlock password needs at least 8 characters.', error: true });
    await Boundaries?.changeUnlockPassword(master, newUnlock);
    setNewUnlock('');
    setMessage({ text: 'Unlock password updated.', error: false });
  });

  const saveMaster = () => run(async () => {
    if (newMaster.length < MIN_LENGTH) return setMessage({ text: 'The new master password needs at least 8 characters.', error: true });
    await Boundaries?.changeMasterPassword(master, newMaster);
    setMaster(newMaster);
    setNewMaster('');
    setMessage({ text: 'Master password updated.', error: false });
  });

  return (
    <Screen back>
      <AppText variant="display">Change passwords</AppText>
      {!unlocked ? (
        <Card style={styles.card}>
          <AppText color="muted">Enter your master password to change either password.</AppText>
          <PasswordField value={master} onChangeText={setMaster} placeholder="Master password" autoFocus onSubmitEditing={() => void verify()} />
          <AppButton
            label={wait.waiting ? `Wait ${wait.remaining} s` : 'Continue'}
            loading={busy}
            disabled={wait.waiting}
            onPress={() => void verify()}
          />
        </Card>
      ) : (
        <>
          <Card style={styles.card}>
            <AppText variant="heading">Unlock password</AppText>
            <PasswordField value={newUnlock} onChangeText={setNewUnlock} placeholder="New unlock password" />
            <AppButton label="Update unlock password" disabled={busy} onPress={() => void saveUnlock()} />
          </Card>
          <Card style={styles.card}>
            <AppText variant="heading">Master password</AppText>
            <PasswordField value={newMaster} onChangeText={setNewMaster} placeholder="New master password" />
            <AppButton label="Update master password" disabled={busy} onPress={() => void saveMaster()} />
          </Card>
        </>
      )}
      {message ? <AppText color={message.error ? 'danger' : 'success'}>{message.text}</AppText> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
});
