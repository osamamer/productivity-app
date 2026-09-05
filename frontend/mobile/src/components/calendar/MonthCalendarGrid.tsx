import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { localDate } from '@/lib/date';
import { useAppTheme } from '@/providers/ThemeProvider';
import { AppText } from '../ui/AppText';
import { Card } from '../ui/Card';
import { SilentPressable } from '../ui/SilentPressable';

export type CalendarItemKind = 'calendarEvent' | 'task' | 'taskGroup' | 'stat';

export interface CalendarGridItem {
  id: string;
  sourceId: string;
  date: string;
  title: string;
  kind: CalendarItemKind;
  completed?: boolean;
  timeLabel?: string;
  color?: string;
  textColor?: string;
}

interface MonthCalendarGridProps {
  month: Date;
  itemsByDate: Map<string, CalendarGridItem[]>;
  loading?: boolean;
  onMonthChange: (offset: number) => void;
  onToday: () => void;
  onDayPress: (date: string, items: CalendarGridItem[]) => void;
  onItemPress: (item: CalendarGridItem) => void;
}

function monthStart(month: Date): Date {
  return new Date(month.getFullYear(), month.getMonth(), 1);
}

function gridDays(month: Date): Date[] {
  const first = monthStart(month);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function monthLabel(month: Date): string {
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(month);
}

function itemLabel(item: CalendarGridItem): string {
  const prefix = item.kind === 'taskGroup' ? 'Group' : item.kind === 'task' ? 'Task' : item.kind === 'stat' ? 'Stat' : 'Event';
  return `${prefix}: ${item.title}${item.timeLabel ? ` at ${item.timeLabel}` : ''}`;
}

export function MonthCalendarGrid({
  month,
  itemsByDate,
  loading = false,
  onMonthChange,
  onToday,
  onDayPress,
  onItemPress,
}: MonthCalendarGridProps) {
  const { colors } = useAppTheme();
  const days = useMemo(() => gridDays(month), [month]);
  const currentMonth = month.getMonth();
  const currentYear = month.getFullYear();
  const today = localDate();

  return (
    <Card style={styles.card}>
      <View style={styles.toolbar}>
        <View style={styles.monthTitle}>
          <AppText variant="heading">{monthLabel(month)}</AppText>
        </View>
        <View style={styles.navigation}>
          <SilentPressable accessibilityRole="button" accessibilityLabel="Previous month" hitSlop={8} onPress={() => onMonthChange(-1)} style={styles.navButton}>
            <Ionicons name="chevron-back" size={19} color={colors.textMuted} />
          </SilentPressable>
          <SilentPressable accessibilityRole="button" accessibilityLabel="Go to today" onPress={onToday} style={[styles.todayButton, { backgroundColor: colors.accentSoft }]}>
            <AppText variant="caption" color="accent">Today</AppText>
          </SilentPressable>
          <SilentPressable accessibilityRole="button" accessibilityLabel="Next month" hitSlop={8} onPress={() => onMonthChange(1)} style={styles.navButton}>
            <Ionicons name="chevron-forward" size={19} color={colors.textMuted} />
          </SilentPressable>
        </View>
      </View>

      <View style={[styles.weekdays, { borderBottomColor: colors.border }]}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
          <AppText key={`${day}-${index}`} variant="caption" color="muted" style={styles.weekday}>{day}</AppText>
        ))}
      </View>

      {loading ? (
        <View style={styles.loadingGrid}>
          <AppText color="muted">Loading your calendar…</AppText>
        </View>
      ) : (
        <View style={styles.grid}>
          {days.map(day => {
            const key = localDate(day);
            const items = itemsByDate.get(key) ?? [];
            const inMonth = day.getFullYear() === currentYear && day.getMonth() === currentMonth;
            const isToday = key === today;
            const visibleItems = items.slice(0, 4);
            const extraCount = items.length - visibleItems.length;
            return (
              <SilentPressable
                key={key}
                accessibilityRole="button"
                accessibilityLabel={`${day.toLocaleDateString()}${items.length ? `, ${items.length} items` : ''}`}
                onPress={() => onDayPress(key, items)}
                style={({ pressed }) => [
                  styles.day,
                  { borderColor: colors.border, backgroundColor: inMonth ? colors.surface : colors.background },
                  !inMonth && styles.outsideDay,
                  isToday && { backgroundColor: colors.accentSoft, borderColor: colors.accent },
                  pressed && styles.pressed,
                ]}>
                <View style={styles.dayHeader}>
                  <View style={[styles.dayNumber, isToday && { backgroundColor: colors.accent }]}>
                    <AppText variant="caption" style={{ color: isToday ? colors.onAccent : inMonth ? colors.text : colors.textMuted }}>{day.getDate()}</AppText>
                  </View>
                  {items.length > 0 && <AppText variant="caption" color="muted">{items.length}</AppText>}
                </View>
                <View style={styles.items}>
                  {visibleItems.map(item => {
                    const accent = item.color ?? colors.accent;
                    const foreground = item.textColor ?? colors.text;
                    return (
                      <SilentPressable
                        key={item.id}
                        accessibilityRole="button"
                        accessibilityLabel={itemLabel(item)}
                        onPress={pressEvent => { pressEvent.stopPropagation(); onItemPress(item); }}
                        style={({ pressed }) => [
                          styles.item,
                          {
                            backgroundColor: item.kind === 'calendarEvent' ? accent : `${accent}20`,
                            borderColor: item.kind === 'calendarEvent' ? accent : `${accent}70`,
                          },
                          pressed && styles.pressed,
                        ]}>
                        {item.completed ? <Ionicons name="checkmark" size={9} color={colors.success} /> : <View style={[styles.itemDot, { backgroundColor: accent }]} />}
                        <AppText variant="caption" numberOfLines={1} style={[styles.itemText, { color: item.kind === 'calendarEvent' ? foreground : colors.text, fontSize: 9, lineHeight: 12 }]}>
                          {item.title}{item.timeLabel ? ` · ${item.timeLabel}` : ''}
                        </AppText>
                      </SilentPressable>
                    );
                  })}
                  {extraCount > 0 && (
                    <SilentPressable accessibilityRole="button" accessibilityLabel={`Show ${extraCount} more items`} onPress={pressEvent => { pressEvent.stopPropagation(); onDayPress(key, items); }}>
                      <AppText variant="caption" color="accent" numberOfLines={1} style={styles.more}>+{extraCount} more</AppText>
                    </SilentPressable>
                  )}
                </View>
              </SilentPressable>
            );
          })}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: 6, gap: 8 },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  monthTitle: { flex: 1, gap: 2 },
  navigation: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  navButton: { width: 32, height: 36, alignItems: 'center', justifyContent: 'center' },
  todayButton: { minHeight: 32, borderRadius: 10, justifyContent: 'center', paddingHorizontal: 9 },
  weekdays: { flexDirection: 'row', borderBottomWidth: 1, paddingBottom: 4 },
  weekday: { flex: 1, textAlign: 'center', fontSize: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 3 },
  day: { width: '14.2857%', minHeight: 108, borderWidth: 1, borderRadius: 8, padding: 3, gap: 4 },
  outsideDay: { opacity: 0.6 },
  dayHeader: { minHeight: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dayNumber: { minWidth: 21, height: 21, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  items: { gap: 2, minWidth: 0 },
  item: { minHeight: 20, borderRadius: 4, borderWidth: 1, paddingHorizontal: 2, flexDirection: 'row', alignItems: 'center', gap: 2, overflow: 'hidden' },
  itemDot: { width: 4, height: 4, borderRadius: 2, flexShrink: 0 },
  itemText: { flex: 1, minWidth: 0 },
  more: { fontSize: 9, lineHeight: 12, paddingHorizontal: 2 },
  loadingGrid: { minHeight: 500, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.7 },
});
