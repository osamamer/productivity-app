import { PropsWithChildren, ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '@/providers/ThemeProvider';
import { AppText } from './AppText';

interface Props {
  title?: string;
  eyebrow?: string;
  action?: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
}

export function Screen({
  children,
  title,
  eyebrow,
  action,
  scroll = true,
  refreshing = false,
  onRefresh,
  contentStyle,
}: PropsWithChildren<Props>) {
  const { colors } = useAppTheme();
  const body = (
    <View style={[styles.content, contentStyle]}>
      {(title || eyebrow || action) && (
        <View style={styles.header}>
          <View style={styles.headerText}>
            {eyebrow && <AppText variant="caption" color="accent">{eyebrow.toUpperCase()}</AppText>}
            {title && <AppText variant="title">{title}</AppText>}
          </View>
          {action}
        </View>
      )}
      {children}
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: colors.background }]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} /> : undefined}>
          {body}
        </ScrollView>
      ) : body}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flexGrow: 1 },
  content: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 120, gap: 16 },
  header: { minHeight: 54, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 16 },
  headerText: { flex: 1, gap: 3 },
});
