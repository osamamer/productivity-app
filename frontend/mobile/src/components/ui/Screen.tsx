import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { PropsWithChildren, ReactNode } from 'react';
import { RefreshControl, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '@/providers/ThemeProvider';
import { SilentPressable } from './SilentPressable';
import { KeyboardAwareScrollView, KeyboardAwareView } from './KeyboardAwareScrollView';

interface Props {
  back?: boolean;
  action?: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  refreshEnabled?: boolean;
  safeAreaTop?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  overlay?: ReactNode;
  scrollToTopKey?: string | number | null;
}

export function Screen({
  children,
  back = false,
  action,
  scroll = true,
  refreshing = false,
  onRefresh,
  refreshEnabled = true,
  safeAreaTop = true,
  contentStyle,
  overlay,
  scrollToTopKey = null,
}: PropsWithChildren<Props>) {
  const { colors } = useAppTheme();
  const body = (
    <View style={[styles.content, contentStyle]}>
      {(back || action) && (
        <View style={styles.controls}>
          {back && (
            <SilentPressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={10}
              onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}
              style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </SilentPressable>
          )}
          {action}
        </View>
      )}
      {children}
    </View>
  );

  return (
    <SafeAreaView edges={safeAreaTop ? ['top'] : []} style={[styles.safe, { backgroundColor: colors.background }]}>
      {scroll ? (
        <KeyboardAwareScrollView
          contentContainerStyle={styles.scroll}
          scrollToTopKey={scrollToTopKey}
          keyboardShouldPersistTaps="handled"
          refreshControl={onRefresh ? <RefreshControl enabled={refreshEnabled} refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} /> : undefined}>
          {body}
        </KeyboardAwareScrollView>
      ) : <KeyboardAwareView>{body}</KeyboardAwareView>}
      {overlay}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flexGrow: 1 },
  content: { paddingHorizontal: 18, paddingTop: 0, paddingBottom: 120, gap: 16 },
  controls: { minHeight: 40, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backButton: { width: 40, height: 40, justifyContent: 'center' },
});
