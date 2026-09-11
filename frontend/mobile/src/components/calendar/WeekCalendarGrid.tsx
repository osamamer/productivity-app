import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { localDate } from '@/lib/date';
import { useAppTheme } from '@/providers/ThemeProvider';
import { AppText } from '../ui/AppText';
import { SilentPressable } from '../ui/SilentPressable';
import type { CalendarGridItem } from './MonthCalendarGrid';

interface WeekCalendarGridProps {
  weekStart: Date;
  itemsByDate: Map<string, CalendarGridItem[]>;
  loading?: boolean;
  onWeekChange: (offset: number) => void;
  onToday: () => void;
  onDayPress: (date: string, items: CalendarGridItem[]) => void;
  onItemPress: (item: CalendarGridItem) => void;
}

function weekDays(start: Date): Date[] {
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function weekLabel(start: Date): string {
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const startLabel = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(start);
  const endLabel = new Intl.DateTimeFormat(undefined, sameMonth
    ? { day: 'numeric', year: 'numeric' }
    : { month: 'short', day: 'numeric', year: 'numeric' }).format(end);
  return `${startLabel} – ${endLabel}`;
}

function dayLabel(day: Date): string {
  return new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric' }).format(day);
}

function itemLabel(item: CalendarGridItem): string {
  const prefix = item.kind === 'taskGroup' ? 'Group' : item.kind === 'task' ? 'Task' : item.kind === 'stat' ? 'Stat' : 'Event';
  const status = item.eventStatus ? `, ${item.eventStatus.toLowerCase()}` : '';
  return `${prefix}: ${item.title}${item.timeLabel ? ` at ${item.timeLabel}` : ''}${status}`;
}

function WeekItem({ item, onPress }: { item: CalendarGridItem; onPress: () => void }) {
  const { colors } = useAppTheme();
  const accent = item.color ?? colors.accent;
  const foreground = item.textColor ?? colors.text;

  return (
    <SilentPressable
      accessibilityRole="button"
      accessibilityLabel={itemLabel(item)}
      onPress={onPress}
      style={({ pressed }) => [
        styles.item,
        {
          backgroundColor: item.kind === 'calendarEvent' ? accent : `${accent}20`,
          borderColor: item.kind === 'calendarEvent' ? accent : `${accent}70`,
          borderStyle: item.eventStatus === 'TENTATIVE' ? 'dashed' : 'solid',
          opacity: item.eventStatus === 'CANCELLED' ? 0.65 : 1,
        },
        pressed && styles.pressed,
      ]}>
      {item.completed ? <Ionicons name="checkmark" size={13} color={colors.success} /> : <View style={[styles.itemDot, { backgroundColor: accent }]} />}
      <AppText
        variant="body"
        numberOfLines={2}
        style={[styles.itemText, { color: item.kind === 'calendarEvent' ? foreground : colors.text }, item.eventStatus === 'CANCELLED' && styles.cancelledText]}>
        {item.title}
      </AppText>
      {item.timeLabel && <AppText variant="caption" color="muted" style={styles.itemTime}>{item.timeLabel}</AppText>}
    </SilentPressable>
  );
}

export function WeekCalendarGrid({
  weekStart,
  itemsByDate,
  loading = false,
  onWeekChange,
  onToday,
  onDayPress,
  onItemPress,
}: WeekCalendarGridProps) {
  const { colors } = useAppTheme();
  const days = useMemo(() => weekDays(weekStart), [weekStart]);
  const today = localDate();

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <AppText variant="heading" style={styles.title}>{weekLabel(weekStart)}</AppText>
        <View style={styles.navigation}>
          <SilentPressable accessibilityRole="button" accessibilityLabel="Previous week" hitSlop={8} onPress={() => onWeekChange(-1)} style={styles.navButton}>
            <Ionicons name="chevron-back" size={19} color={colors.textMuted} />
          </SilentPressable>
          <SilentPressable accessibilityRole="button" accessibilityLabel="Go to today" onPress={onToday} style={[styles.todayButton, { backgroundColor: colors.accentSoft }]}>
            <AppText variant="caption" color="accent">Today</AppText>
          </SilentPressable>
          <SilentPressable accessibilityRole="button" accessibilityLabel="Next week" hitSlop={8} onPress={() => onWeekChange(1)} style={styles.navButton}>
            <Ionicons name="chevron-forward" size={19} color={colors.textMuted} />
          </SilentPressable>
        </View>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <AppText color="muted">Loading your calendar…</AppText>
        </View>
      ) : (
        <View style={styles.days}>
          {days.map(day => {
            const key = localDate(day);
            const items = itemsByDate.get(key) ?? [];
            const isToday = key === today;
            return (
              <View key={key} style={[styles.day, { borderColor: colors.border }]}>
                <SilentPressable
                  accessibilityRole="button"
                  accessibilityLabel={`${dayLabel(day)}${items.length ? `, ${items.length} items` : ''}`}
                  onPress={() => onDayPress(key, items)}
                  style={({ pressed }) => [styles.dayHeader, isToday && { backgroundColor: colors.accentSoft, borderColor: colors.accent }, isToday && styles.todayHeader, pressed && styles.pressed]}>
                  <View style={styles.dayHeading}>
                    <AppText variant="label" style={isToday && { color: colors.accent }}>{dayLabel(day)}</AppText>
                    {isToday && <AppText variant="caption" color="accent">Today</AppText>}
                  </View>
                  <AppText variant="caption" color="muted">{items.length ? `${items.length} item${items.length === 1 ? '' : 's'}` : 'Free'}</AppText>
                </SilentPressable>
                {items.length > 0 && (
                  <View style={styles.items}>
                    {items.map(item => <WeekItem key={item.id} item={item} onPress={() => onItemPress(item)} />)}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', maxWidth: 560, alignSelf: 'center', gap: 10 },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { flex: 1 },
  navigation: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  navButton: { width: 32, height: 36, alignItems: 'center', justifyContent: 'center' },
  todayButton: { minHeight: 32, borderRadius: 10, justifyContent: 'center', paddingHorizontal: 9 },
  days: { gap: 6 },
  day: { borderWidth: 1, borderRadius: 10, padding: 6, gap: 5 },
  dayHeader: { gap: 3 },
  todayHeader: { borderWidth: 1, borderRadius: 7, paddingHorizontal: 7, paddingVertical: 5, margin: -1 },
  dayHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  items: { gap: 5 },
  item: { minHeight: 36, borderRadius: 7, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 5, overflow: 'hidden' },
  itemDot: { width: 6, height: 6, borderRadius: 3, flexShrink: 0 },
  itemText: { flex: 1, minWidth: 0 },
  itemTime: { flexShrink: 0 },
  loading: { minHeight: 320, alignItems: 'center', justifyContent: 'center' },
  cancelledText: { textDecorationLine: 'line-through' },
  pressed: { opacity: 0.7 },
});
