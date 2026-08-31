import { Image, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/ui/AppButton';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { mobileAuthRedirectUri, useAuth } from '@/providers/AuthProvider';
import { useAppTheme } from '@/providers/ThemeProvider';

export default function SignInScreen() {
  const { colors } = useAppTheme();
  const { login, error } = useAuth();
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <View style={styles.hero}>
          <View style={[styles.logoWrap, { backgroundColor: colors.accentSoft }]}>
            <Image source={require('../../assets/images/productivity.png')} style={styles.logo} />
          </View>
          <AppText variant="display" style={styles.center}>So life doesn’t get overwhelming.</AppText>
          <AppText color="muted" style={styles.center}>
            Your tasks, focus, reflections, and routines—kept gently in one place.
          </AppText>
        </View>
        <Card style={styles.card}>
          <AppText variant="heading">Welcome back</AppText>
          <AppText color="muted">Sign in securely through your existing account.</AppText>
          {error && <AppText color="danger">{error}</AppText>}
          <AppButton label="Continue to sign in" icon="arrow-forward" onPress={() => void login()} />
          <AppText variant="caption" color="muted" style={styles.center}>
            Mobile redirect: {mobileAuthRedirectUri}
          </AppText>
        </Card>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flex: 1, padding: 22, justifyContent: 'space-between', gap: 24 },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  logoWrap: { width: 124, height: 124, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 92, height: 92, resizeMode: 'contain' },
  center: { textAlign: 'center' },
  card: { gap: 14 },
});
