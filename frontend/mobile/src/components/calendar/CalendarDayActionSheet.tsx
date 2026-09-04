import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { formatLongDate } from '@/lib/date';
import { useAppTheme } from '@/providers/ThemeProvider';
import type { CalendarGridItem } from './MonthCalendarGrid';
import { AppButton } from '../ui/AppButton';
import { AppText } from '../ui/AppText';
import { ChoiceChips } from '../ui/ChoiceChips';
import { ModalSheet } from '../ui/ModalSheet';
import { SilentPressable } from '../ui/SilentPressable';

export type CalendarCreateTab = 'event' | 'task' | 'stats';

interface CalendarDayActionSheetProps {
  date: string | null;
  items: CalendarGridItem[];
  allowTasks: boolean;
  allowStats: boolean;
  initialTab?: CalendarCreateTab;
  onClose: () => void;
  onCreate: (tab: CalendarCreateTab) => void;
  onItemPress: (item: CalendarGridItem) => void;
}

function dateFromKey(value: string): Date {
  return new Date(`${value}T12:00:00`);
}

function itemKindLabel(item: CalendarGridItem): string {
  if (item.kind === 'calendarEvent') return 'Event';
  if (item.kind === 'taskGroup') return 'Task group';
  if (item.kind === 'stat') return 'Statistic';
  return 'Task';
}

export function CalendarDayActionSheet({
  date,
  items,
  allowTasks,
  allowStats,
  initialTab = 'event',
  onClose,
  onCreate,
  onItemPress,
}: CalendarDayActionSheetProps) {
  const { colors } = useAppTheme();
  const [tab, setTab] = useState<CalendarCreateTab>(initialTab);
  const options = [
    { value: 'event' as const, label: 'Event' },
    ...(allowTasks ? [{ value: 'task' as const, label: 'Task' }] : []),
    ...(allowStats ? [{ value: 'stats' as const, label: 'Stats' }] : []),
  ];

  return (
    <ModalSheet visible={Boolean(date)} onClose={onClose} title={date ? formatLongDate(dateFromKey(date)) : 'Calendar day'} footer={(
      <AppButton
        icon={tab === 'event' ? 'calendar-outline' : tab === 'task' ? 'add' : 'stats-chart-outline'}
        label={`Add ${tab === 'stats' ? 'stats' : tab}`}
        onPress={() => date && onCreate(tab)} />
    )}>
      <AppText color="muted">Choose what belongs on this day.</AppText>
      <ChoiceChips value={tab} onChange={setTab} options={options} />

      <View style={styles.sectionHeading}>
        <AppText variant="label">On this day</AppText>
        <AppText variant="caption" color="muted">{items.length}</AppText>
      </View>
      {items.length ? items.map(item => (
        <SilentPressable
          key={item.id}
          accessibilityRole="button"
          accessibilityLabel={`Open ${itemKindLabel(item)} ${item.title}`}
          onPress={() => onItemPress(item)}
          style={({ pressed }) => [styles.item, { borderColor: colors.border, backgroundColor: colors.background }, pressed && styles.pressed]}>
          <View style={[styles.itemIcon, { backgroundColor: item.kind === 'calendarEvent' ? colors.accent : colors.accentSoft }]}>
            <Ionicons
              name={item.kind === 'calendarEvent' ? 'calendar-outline' : item.kind === 'stat' ? 'stats-chart-outline' : item.kind === 'taskGroup' ? 'layers-outline' : item.completed ? 'checkmark' : 'checkmark-outline'}
              size={17}
              color={item.kind === 'calendarEvent' ? colors.onAccent : colors.accent} />
          </View>
          <View style={styles.itemCopy}>
            <AppText variant="label" numberOfLines={1}>{item.title}</AppText>
            <AppText variant="caption" color="muted" numberOfLines={1}>{itemKindLabel(item)}{item.timeLabel ? ` · ${item.timeLabel}` : ''}</AppText>
          </View>
          <Ionicons name="chevron-forward" size={17} color={colors.textMuted} />
        </SilentPressable>
      )) : (
        <View style={styles.empty}>
          <AppText color="muted">Nothing scheduled yet.</AppText>
        </View>
      )}
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  item: { minHeight: 58, borderWidth: 1, borderRadius: 15, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 11 },
  itemIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  itemCopy: { flex: 1, gap: 3 },
  empty: { minHeight: 62, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.72 },
});
