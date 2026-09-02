import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/providers/ThemeProvider';
import { GENERIC_ERROR_MESSAGE } from '@/lib/errors';
import { AppButton } from './AppButton';
import { AppText } from './AppText';

export function LoadingView({ label = 'Loading…' }: { label?: string }) {
  const { colors } = useAppTheme();
  return <View style={styles.state}><ActivityIndicator color={colors.accent} /><AppText color="muted">{label}</AppText></View>;
}

export function EmptyView({ title, message }: { title: string; message: string }) {
  return <View style={styles.state}><AppText variant="heading">{title}</AppText><AppText color="muted" style={styles.center}>{message}</AppText></View>;
}

export function ErrorView({ message: _message, retry }: { message: string; retry?: () => void }) {
  return (
    <View style={styles.state}>
      <AppText variant="heading" color="danger">Something went wrong</AppText>
      <AppText color="muted" style={styles.center}>{GENERIC_ERROR_MESSAGE}</AppText>
      {retry && <AppButton compact variant="secondary" label="Try again" onPress={retry} />}
    </View>
  );
}

const styles = StyleSheet.create({
  state: { minHeight: 160, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  center: { textAlign: 'center' },
});
