import { PropsWithChildren, ReactNode } from 'react';
import { RefreshControl, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '@/providers/ThemeProvider';
import { AppText } from './AppText';
import { KeyboardAwareScrollView, KeyboardAwareView } from './KeyboardAwareScrollView';

interface Props {
  title?: string;
  eyebrow?: string;
  action?: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  refreshEnabled?: boolean;
  safeAreaTop?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  overlay?: ReactNode;
}

export function Screen({
  children,
  title,
  eyebrow,
  action,
  scroll = true,
  refreshing = false,
  onRefresh,
  refreshEnabled = true,
  safeAreaTop = true,
  contentStyle,
  overlay,
}: PropsWithChildren<Props>) {
  const { colors } = useAppTheme();
  const body = (
    <View style={[styles.content, contentStyle]}>
      {(title || eyebrow || action) && (
        <View style={[styles.header, !title && styles.headerWithoutTitle]}>
          <View style={styles.headerText}>
            {eyebrow && <AppText variant="heading" color="accent">{eyebrow}</AppText>}
            {title && <AppText variant="title">{title}</AppText>}
          </View>
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
  header: { minHeight: 54, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 16 },
  headerWithoutTitle: { minHeight: 32 },
  headerText: { flex: 1, gap: 3 },
});
