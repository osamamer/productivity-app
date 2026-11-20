import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppPopup } from '@/components/ui/AppPopup';
import { AppText } from '@/components/ui/AppText';
import { PasswordField } from './PasswordField';
import { usePasswordWait } from './usePasswordWait';

interface Props {
  visible: boolean;
  title: string;
  message: string;
  placeholder: string;
  submitLabel: string;
  incorrectMessage: string;
  onCancel: () => void;
  verify: (password: string) => Promise<boolean>;
  /** Runs once the password was right and the wait has ended. */
  onConfirmed: (password: string) => Promise<void>;
}

/**
 * Asks for the unlock or master password before a loosening action, then waits ten seconds
 * before doing it. Starts empty each time it opens.
 */
export function PasswordPrompt(props: Props) {
  return props.visible ? <OpenPasswordPrompt {...props} /> : null;
}

function OpenPasswordPrompt({ title, message, placeholder, submitLabel, incorrectMessage, onCancel, verify, onConfirmed }: Props) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const wait = usePasswordWait();

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirmed(password);
    } catch (cause) {
      console.error(`${title} failed:`, cause);
      setError(cause instanceof Error ? cause.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (wait.waiting) return;
    if (!password) {
      setError('Enter the password');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (await verify(password)) wait.start(() => void confirm());
      else setError(incorrectMessage);
    } finally {
      setBusy(false);
    }
  };

  const cancel = () => {
    wait.cancel();
    onCancel();
  };

  return (
    <AppPopup
      visible
      title={title}
      message={message}
      onClose={cancel}
      dismissOnBackdrop={!busy}
      footer={(
        <View style={styles.actions}>
          <AppButton style={styles.action} variant="secondary" label="Cancel" disabled={busy} onPress={cancel} />
          <AppButton
            style={styles.action}
            label={wait.waiting ? `Wait ${wait.remaining} s` : submitLabel}
            loading={busy}
            disabled={wait.waiting}
            onPress={() => void submit()}
          />
        </View>
      )}>
      <PasswordField
        value={password}
        onChangeText={setPassword}
        placeholder={placeholder}
        autoFocus
        editable={!wait.waiting}
        onSubmitEditing={() => void submit()}
      />
      {wait.waiting ? <AppText variant="caption" color="muted">A moment to be sure. This goes through in {wait.remaining} s.</AppText> : null}
      {error ? <AppText variant="caption" color="danger">{error}</AppText> : null}
    </AppPopup>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: 10 },
  action: { flex: 1 },
});
