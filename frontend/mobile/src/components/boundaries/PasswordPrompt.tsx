import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppPopup } from '@/components/ui/AppPopup';
import { AppText } from '@/components/ui/AppText';
import { PasswordField } from './PasswordField';

export type PasswordResult = { ok: true } | { ok: false; error: string };

interface Props {
  visible: boolean;
  title: string;
  message: string;
  placeholder: string;
  submitLabel: string;
  onCancel: () => void;
  onSubmit: (password: string) => Promise<PasswordResult>;
}

/** Asks for the unlock or master password before a loosening action. Starts empty each time it opens. */
export function PasswordPrompt(props: Props) {
  return props.visible ? <OpenPasswordPrompt {...props} /> : null;
}

function OpenPasswordPrompt({ title, message, placeholder, submitLabel, onCancel, onSubmit }: Props) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!password) {
      setError('Enter the password');
      return;
    }
    setBusy(true);
    try {
      const result = await onSubmit(password);
      if (!result.ok) setError(result.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppPopup
      visible
      title={title}
      message={message}
      onClose={onCancel}
      dismissOnBackdrop={!busy}
      footer={(
        <View style={styles.actions}>
          <AppButton style={styles.action} variant="secondary" label="Cancel" disabled={busy} onPress={onCancel} />
          <AppButton style={styles.action} label={submitLabel} loading={busy} onPress={() => void submit()} />
        </View>
      )}>
      <PasswordField value={password} onChangeText={setPassword} placeholder={placeholder} autoFocus onSubmitEditing={() => void submit()} />
      {error ? <AppText variant="caption" color="danger">{error}</AppText> : null}
    </AppPopup>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: 10 },
  action: { flex: 1 },
});
