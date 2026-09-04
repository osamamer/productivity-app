import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { KeyboardAwareScrollView } from '@/components/ui/KeyboardAwareScrollView';
import { useAuth } from '@/providers/AuthProvider';
import { useAppTheme } from '@/providers/ThemeProvider';

export default function SignInScreen() {
  const { colors } = useAppTheme();
  const { login, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  async function submit() {
    setSubmitting(true);
    try { await login(email, password); }
    finally { setSubmitting(false); }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <KeyboardAwareScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag">
        <View style={styles.hero}>
          <View style={[styles.logoWrap, { backgroundColor: colors.accentSoft }]}>
            <Image source={require('../../assets/images/eye-care.png')} style={styles.logo} />
          </View>
          <AppText variant="display" style={styles.center}>Claritard keeps life from getting overwhelming.</AppText>
          <AppText color="muted" style={styles.center}>
            Your tasks, focus, reflections, and routines—kept gently in one place.
          </AppText>
        </View>
        <Card style={styles.card}>
          <AppText variant="heading">Welcome back</AppText>
          <AppText color="muted">Sign in to bring your day, focus sessions, and reflections with you.</AppText>
          {error && <AppText color="danger">{error}</AppText>}
          <AppInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            autoComplete="username"
            importantForAutofill="yes"
            keyboardType="email-address"
            returnKeyType="next"
          />
          <AppInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            spellCheck={false}
            autoComplete="current-password"
            importantForAutofill="yes"
            returnKeyType="go"
            onSubmitEditing={() => void submit()}
          />
          <AppButton label="Sign in" icon="arrow-forward" loading={submitting} onPress={() => void submit()} />
          <AppText variant="caption" color="muted" style={styles.center}>
            Your password is never stored by Claritard.
          </AppText>
        </Card>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flexGrow: 1, padding: 22, justifyContent: 'space-between', gap: 24 },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  logoWrap: { width: 124, height: 124, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 92, height: 92, resizeMode: 'contain' },
  center: { textAlign: 'center' },
  card: { gap: 14 },
});
