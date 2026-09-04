import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/providers/ThemeProvider';
import { AppText } from '../ui/AppText';
import { SilentPressable } from '../ui/SilentPressable';

type ActionButtonProps = {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
};

function ActionButton({ label, icon, onPress, disabled = false, danger = false }: ActionButtonProps) {
  const { colors } = useAppTheme();
  const foreground = danger ? colors.danger : colors.accent;
  return (
    <SilentPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        { backgroundColor: danger ? `${colors.danger}12` : colors.accentSoft },
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}>
      <Ionicons name={icon} size={19} color={foreground} />
    </SilentPressable>
  );
}

export function TaskSelectionActionsPopup({
  visible,
  taskCount,
  loading = false,
  canMoveToToday = false,
  canReorder = false,
  canGroup = false,
  onComplete,
  onMoveToToday,
  onMoveToDate,
  onMoveUp,
  onMoveDown,
  onGroup,
  onDelete,
  onDismiss,
}: {
  visible: boolean;
  taskCount: number;
  loading?: boolean;
  canMoveToToday?: boolean;
  canReorder?: boolean;
  canGroup?: boolean;
  onComplete: () => void;
  onMoveToToday?: () => void;
  onMoveToDate: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onGroup?: () => void;
  onDelete: () => void;
  onDismiss: () => void;
}) {
  const { colors } = useAppTheme();
  if (!visible) return null;

  const countLabel = `${taskCount} task${taskCount === 1 ? '' : 's'} selected`;

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.heading}>
          <AppText variant="caption" color="muted">{countLabel}</AppText>
          <SilentPressable
            accessibilityRole="button"
            accessibilityLabel="Clear task selection"
            hitSlop={8}
            onPress={onDismiss}>
            <Ionicons name="close" size={19} color={colors.textMuted} />
          </SilentPressable>
        </View>
        <View style={styles.actions}>
          <ActionButton label="Complete selected tasks" icon="checkmark-circle-outline" onPress={onComplete} disabled={loading} />
          {canMoveToToday && onMoveToToday && (
            <ActionButton label="Move selected tasks to today" icon="today-outline" onPress={onMoveToToday} disabled={loading} />
          )}
          <ActionButton label="Move selected tasks to a date" icon="calendar-outline" onPress={onMoveToDate} disabled={loading} />
          {canReorder && onMoveUp && onMoveDown && (
            <>
              <ActionButton label="Move selected task up" icon="arrow-up" onPress={onMoveUp} disabled={loading} />
              <ActionButton label="Move selected task down" icon="arrow-down" onPress={onMoveDown} disabled={loading} />
            </>
          )}
          {canGroup && onGroup && (
            <ActionButton label="Group selected tasks" icon="folder-open-outline" onPress={onGroup} disabled={loading} />
          )}
          <ActionButton label="Delete selected tasks" icon="trash-outline" onPress={onDelete} disabled={loading} danger />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, justifyContent: 'flex-end', padding: 14 },
  card: { width: '100%', maxWidth: 380, alignSelf: 'center', borderRadius: 18, borderWidth: 1, padding: 10, gap: 8, shadowColor: '#11111A', shadowOffset: { width: 0, height: 6 }, shadowRadius: 18, shadowOpacity: 0.18, elevation: 7 },
  heading: { minHeight: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 3 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  action: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.96 }] },
});
