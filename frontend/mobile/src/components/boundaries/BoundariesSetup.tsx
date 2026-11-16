import { useState } from 'react';

import { AppButton } from '@/components/ui/AppButton';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { Boundaries } from '@/services/boundaries';
import { PasswordField } from './PasswordField';

const MIN_LENGTH = 8;

/** First run: the two passwords that guard loosening a boundary. There is no recovery. */
export function BoundariesSetup({ onDone }: { onDone: () => void }) {
  const [unlock, setUnlock] = useState('');
  const [unlockConfirm, setUnlockConfirm] = useState('');
  const [master, setMaster] = useState('');
  const [masterConfirm, setMasterConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (unlock.length < MIN_LENGTH || master.length < MIN_LENGTH) return setError('Both passwords need at least 8 characters.');
    if (unlock !== unlockConfirm) return setError("The unlock passwords don't match.");
    if (master !== masterConfirm) return setError("The master passwords don't match.");
    if (unlock === master) return setError('Use two different passwords.');
    setBusy(true);
    try {
      await Boundaries?.setupPasswords(unlock, master);
      onDone();
    } catch (cause) {
      console.error('Could not save the Boundaries passwords:', cause);
      setError(cause instanceof Error ? cause.message : 'Could not save the passwords.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen back>
      <AppText variant="display">Set up Boundaries</AppText>
      <AppText color="muted">
        Two passwords keep your future self honest. The unlock password opens this area and pauses
        every boundary for five minutes. The master password turns them off until you switch them
        back on, and is needed to loosen or remove a boundary.
      </AppText>
      <Card style={{ gap: 12 }}>
        <AppText variant="heading">Unlock password</AppText>
        <PasswordField value={unlock} onChangeText={setUnlock} placeholder="At least 8 characters" />
        <PasswordField value={unlockConfirm} onChangeText={setUnlockConfirm} placeholder="Confirm unlock password" />
      </Card>
      <Card style={{ gap: 12 }}>
        <AppText variant="heading">Master password</AppText>
        <PasswordField value={master} onChangeText={setMaster} placeholder="Different from the unlock password" />
        <PasswordField value={masterConfirm} onChangeText={setMasterConfirm} placeholder="Confirm master password" />
      </Card>
      {error ? <AppText color="danger">{error}</AppText> : null}
      <AppButton label="Save and continue" loading={busy} onPress={() => void submit()} />
      <AppText variant="caption" color="muted">
        {'Write these down somewhere safe. There is no recovery: losing both means removing Claritard '
          + 'through Android\'s device-admin settings, which Boundaries deliberately makes inconvenient.'}
      </AppText>
    </Screen>
  );
}
