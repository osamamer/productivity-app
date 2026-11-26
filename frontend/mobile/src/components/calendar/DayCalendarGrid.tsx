import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { layoutDayItems } from '@/lib/dayCalendarLayout';
import { localDate } from '@/lib/date';
import { useAppTheme } from '@/providers/ThemeProvider';
import { AppText } from '../ui/AppText';
import { SilentPressable } from '../ui/SilentPressable';
import type { CalendarGridItem } from './MonthCalendarGrid';
import { CalendarAgendaItem } from './WeekCalendarGrid';

const HOUR_HEIGHT = 72;
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

export function DayCalendarGrid({ date, items, loading, onDayChange, onToday, onDayPress, onItemPress }: {
  date: Date;
  items: CalendarGridItem[];
  loading: boolean;
  onDayChange: (offset: number) => void;
  onToday: () => void;
  onDayPress: (date: string, items: CalendarGridItem[]) => void;
  onItemPress: (item: CalendarGridItem) => void;
}) {
  const { colors } = useAppTheme();
  const { height } = useWindowDimensions();
  const key = localDate(date);
  const scroll = useRef<ScrollView>(null);
  const scrolledDate = useRef<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const timed = useMemo(() => layoutDayItems(items), [items]);
  const untimed = items.filter(item => item.startMinute === undefined);
  const allDayEvents = untimed.filter(item => item.kind === 'calendarEvent');
  const tracking = untimed.filter(item => item.kind === 'stat');
  const unscheduled = untimed.filter(item => item.kind === 'task' || item.kind === 'taskGroup');
  const isToday = key === localDate(now);
  const label = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric' }).format(date);
  const hourLabel = (hour: number) => new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).format(new Date(2000, 0, 1, hour));
  const minuteOfDay = now.getHours() * 60 + now.getMinutes();

  function scrollToDay() {
    if (scrolledDate.current === key || loading) return;
    scrolledDate.current = key;
    const focusMinute = isToday ? minuteOfDay : timed[0]?.start ?? 8 * 60;
    scroll.current?.scrollTo({ y: Math.max(0, focusMinute / 60 - 1) * HOUR_HEIGHT, animated: false });
  }

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <View style={styles.heading}>
          <AppText variant="heading">{label}</AppText>
          <AppText variant="caption" color="muted">{date.getFullYear()} · {items.length} items{isToday ? ' · Today' : ''}</AppText>
        </View>
        <SilentPressable accessibilityRole="button" accessibilityLabel="Previous day" onPress={() => onDayChange(-1)} style={styles.nav}><Ionicons name="chevron-back" size={20} color={colors.textMuted} /></SilentPressable>
        <SilentPressable accessibilityRole="button" accessibilityLabel="Go to today" onPress={onToday} style={styles.nav}><AppText variant="caption" color="accent">Today</AppText></SilentPressable>
        <SilentPressable accessibilityRole="button" accessibilityLabel="Next day" onPress={() => onDayChange(1)} style={styles.nav}><Ionicons name="chevron-forward" size={20} color={colors.textMuted} /></SilentPressable>
      </View>
      <SilentPressable accessibilityRole="button" accessibilityLabel={`Add to ${label}`} onPress={() => onDayPress(key, items)} style={[styles.add, { borderColor: colors.border }]}>
        <Ionicons name="add" size={18} color={colors.accent} /><AppText variant="label" color="accent">Add to this day</AppText>
      </SilentPressable>
      {[
        { label: 'All-day events', entries: allDayEvents },
        { label: 'Daily tracking', entries: tracking },
        { label: 'Without a time', entries: unscheduled },
      ].filter(section => section.entries.length > 0).map(section => (
        <View key={section.label} style={styles.allDay}>
          <AppText variant="label">{section.label}</AppText>
          {section.entries.map(item => <CalendarAgendaItem key={item.id} item={item} onPress={() => onItemPress(item)} />)}
        </View>
      ))}
      <View style={styles.scheduleHeading}>
        <AppText variant="label">Timed schedule</AppText>
        <AppText variant="caption" color="muted">Side-by-side items happen at the same time.</AppText>
      </View>
      {loading && <AppText variant="caption" color="muted">Loading your day…</AppText>}
      <ScrollView ref={scroll} nestedScrollEnabled style={{ height: Math.max(300, height - 330) }} onContentSizeChange={scrollToDay} contentContainerStyle={{ height: HOUR_HEIGHT * 24 + 36 }}>
        {HOURS.map(hour => <View key={hour} style={[styles.hour, { top: hour * HOUR_HEIGHT, height: HOUR_HEIGHT }]}>
          <AppText variant="caption" color="muted" style={styles.hourLabel}>{hourLabel(hour)}</AppText>
          <SilentPressable accessibilityRole="button" accessibilityLabel={`Add to ${label}`} onPress={() => onDayPress(key, items)} style={[styles.hourSlot, { borderTopColor: colors.border }]} />
        </View>)}
        <View pointerEvents="box-none" style={styles.timedItems}>
          {timed.map(({ item, start, end, lane, lanes }) => {
            const event = item.kind === 'calendarEvent';
            const color = item.calendarColor ?? item.color ?? colors.accent;
            return <View key={item.id} pointerEvents="box-none" style={[styles.timedSlot, {
              top: start / 60 * HOUR_HEIGHT, height: (end - start) / 60 * HOUR_HEIGHT,
              left: `${lane / lanes * 100}%`, width: `${100 / lanes}%`,
            }]}><SilentPressable accessibilityRole="button" accessibilityLabel={`${item.title}${item.timeLabel ? `, ${item.timeLabel}` : ''}${item.eventStatus === 'CANCELLED' ? ', cancelled' : ''}`} onPress={() => onItemPress(item)} style={({ pressed }) => [styles.timedItem, {
              backgroundColor: event ? color : colors.surface, borderColor: color,
              opacity: pressed || item.eventStatus === 'CANCELLED' ? 0.65 : 1,
              borderStyle: item.eventStatus === 'TENTATIVE' ? 'dashed' : 'solid',
            }]}>
              <AppText variant="caption" numberOfLines={2} style={{ color: event ? item.textColor : colors.text, textDecorationLine: item.completed || item.eventStatus === 'CANCELLED' ? 'line-through' : 'none' }}>{item.kind === 'calendarEvent' ? 'Event' : item.kind === 'taskGroup' ? 'Task group' : 'Task'} · {item.title}</AppText>
              {end - start >= 45 && item.timeLabel && <AppText variant="caption" numberOfLines={1} style={{ color: event ? item.textColor : colors.textMuted }}>{item.timeLabel}</AppText>}
            </SilentPressable></View>;
          })}
        </View>
        {isToday && <View pointerEvents="none" style={[styles.now, { top: minuteOfDay / 60 * HOUR_HEIGHT, backgroundColor: colors.danger }]} />}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10 }, toolbar: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  heading: { flex: 1, gap: 2 }, nav: { minWidth: 36, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  add: { minHeight: 40, borderWidth: 1, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  allDay: { gap: 6 }, scheduleHeading: { gap: 3 }, hour: { position: 'absolute', left: 0, right: 0, flexDirection: 'row' },
  hourLabel: { width: 52, paddingTop: 3, fontSize: 10 }, hourSlot: { flex: 1, borderTopWidth: 1 },
  timedItems: { position: 'absolute', top: 0, bottom: 0, left: 52, right: 4 },
  timedSlot: { position: 'absolute', paddingHorizontal: 4, paddingBottom: 3 },
  timedItem: { flex: 1, minHeight: 34, borderWidth: 1, borderLeftWidth: 3, borderRadius: 6, padding: 4, overflow: 'hidden' },
  now: { position: 'absolute', left: 46, right: 0, height: 2 },
});
