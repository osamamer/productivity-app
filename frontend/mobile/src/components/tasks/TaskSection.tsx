import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppText } from '@/components/ui/AppText';
import { SilentPressable } from '@/components/ui/SilentPressable';
import { GroupChevron } from '@/components/tasks/GroupChevron';
import { animateLayout } from '@/lib/motion';
import { useAppTheme } from '@/providers/ThemeProvider';

interface Props {
  title: string;
  count: number;
  completedCount: number;
  expanded: boolean;
  onToggle: () => void;
  emptyMessage: string;
  children: ReactNode;
  showMore?: {
    label: string;
    loading?: boolean;
    onPress: () => void;
  };
}

export function TaskSection({
  title,
  count,
  completedCount,
  expanded,
  onToggle,
  emptyMessage,
  children,
  showMore,
}: Props) {
  const { colors } = useAppTheme();
  const toggle = () => {
    animateLayout(360);
    onToggle();
  };

  return (
    <View style={styles.section}>
      <SilentPressable
        accessibilityRole="button"
        accessibilityLabel={`${expanded ? 'Collapse' : 'Expand'} ${title}`}
        accessibilityState={{ expanded }}
        onPress={toggle}
        style={({ pressed }) => [styles.header, { borderBottomColor: colors.border }, pressed && styles.pressed]}>
        <GroupChevron collapsed={!expanded} color={colors.accent} />
        <AppText variant="heading" style={styles.title}>{title}</AppText>
        <AppText variant="caption" color="muted">{count}</AppText>
        {count > 0 && <AppText variant="caption" color="muted" style={styles.completed}>{completedCount}/{count} done</AppText>}
      </SilentPressable>

      {expanded && (
        <View style={styles.body}>
          {count > 0 ? children : <AppText color="muted" style={styles.empty}>{emptyMessage}</AppText>}
          {showMore && (
            <AppButton
              compact
              variant="ghost"
              label={showMore.label}
              loading={showMore.loading}
              onPress={showMore.onPress}
              style={styles.moreButton}
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  header: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { flex: 1 },
  completed: { marginLeft: 4 },
  body: { gap: 8 },
  empty: { paddingVertical: 12, paddingHorizontal: 4 },
  moreButton: { alignSelf: 'flex-start' },
  pressed: { opacity: 0.7 },
});
