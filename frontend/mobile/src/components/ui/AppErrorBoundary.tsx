import { Component, ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAppTheme } from '@/providers/ThemeProvider';
import { AppButton } from './AppButton';
import { AppText } from './AppText';
import { Card } from './Card';

type Props = { children: ReactNode };
type State = { failed: boolean };

function AppErrorView({ onRetry }: { onRetry: () => void }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Card style={styles.card}>
        <View style={[styles.icon, { backgroundColor: colors.accentSoft }]}>
          <Ionicons name="alert-circle-outline" size={30} color={colors.accent} />
        </View>
        <AppText variant="title" style={styles.center}>Something went wrong</AppText>
        <AppText color="muted" style={styles.center}>Please try again.</AppText>
        <AppButton compact variant="secondary" label="Try again" onPress={onRetry} />
      </Card>
    </View>
  );
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: { componentStack: string | null }) {
    console.error('Unexpected mobile application error:', error, info);
  }

  render() {
    return this.state.failed
      ? <AppErrorView onRetry={() => this.setState({ failed: false })} />
      : this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20 },
  card: { alignItems: 'center', gap: 12 },
  icon: { width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
});
