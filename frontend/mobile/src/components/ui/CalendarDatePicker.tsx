import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/providers/ThemeProvider';
import { AppText } from './AppText';
import { SilentPressable } from './SilentPressable';

function monthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function sameCalendarDay(first: Date, second: Date): boolean {
  return first.getFullYear() === second.getFullYear()
    && first.getMonth() === second.getMonth()
    && first.getDate() === second.getDate();
}

export function CalendarDatePicker({ value, onChange }: { value: Date; onChange: (value: Date) => void }) {
  const { colors } = useAppTheme();
  const [month, setMonth] = useState(() => monthStart(value));
  const today = new Date();

  const days = useMemo(() => {
    const firstDay = monthStart(month);
    const firstWeekday = firstDay.getDay();
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const cellCount = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
    return Array.from({ length: cellCount }, (_, index) => {
      const dayNumber = index - firstWeekday + 1;
      return dayNumber >= 1 && dayNumber <= daysInMonth
        ? new Date(month.getFullYear(), month.getMonth(), dayNumber)
        : null;
    });
  }, [month]);

  const monthLabel = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(month);

  return (
    <View style={[styles.calendar, { backgroundColor: colors.background, borderColor: colors.border }]}>
      <View style={styles.calendarHeader}>
        <SilentPressable
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          hitSlop={8}
          onPress={() => setMonth(current => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
          style={({ pressed }) => [styles.navButton, { backgroundColor: colors.surface }, pressed && styles.pressed]}>
          <Ionicons name="chevron-back" size={18} color={colors.textMuted} />
        </SilentPressable>
        <AppText variant="label">{monthLabel}</AppText>
        <SilentPressable
          accessibilityRole="button"
          accessibilityLabel="Next month"
          hitSlop={8}
          onPress={() => setMonth(current => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
          style={({ pressed }) => [styles.navButton, { backgroundColor: colors.surface }, pressed && styles.pressed]}>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </SilentPressable>
      </View>
      <View style={[styles.weekdays, { borderBottomColor: colors.border }]}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
          <AppText key={`${day}-${index}`} variant="caption" color="muted" style={styles.dayLabel}>{day}</AppText>
        ))}
      </View>
      <View style={styles.calendarGrid}>
        {days.map((day, index) => day ? (
          <SilentPressable
            key={day.toISOString()}
            accessibilityRole="button"
            accessibilityLabel={day.toLocaleDateString()}
            onPress={() => onChange(day)}
            style={({ pressed }) => [styles.day, pressed && styles.pressed]}>
            <View style={[
              styles.dayButton,
              sameCalendarDay(day, today) && { borderColor: colors.accent, borderWidth: 1 },
              sameCalendarDay(day, value) && { backgroundColor: colors.accent, borderColor: colors.accent },
            ]}>
              <AppText
                variant="label"
                style={{ color: sameCalendarDay(day, value) ? colors.onAccent : colors.text }}>
                {day.getDate()}
              </AppText>
            </View>
          </SilentPressable>
        ) : <View key={`empty-${index}`} style={styles.day} />)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  calendar: { borderWidth: 1, borderRadius: 18, padding: 12, gap: 12 },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navButton: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  weekdays: { flexDirection: 'row', borderBottomWidth: 1, paddingBottom: 7 },
  dayLabel: { flex: 1, textAlign: 'center', fontSize: 11 },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 5 },
  day: { width: '14.2857%', height: 38, alignItems: 'center', justifyContent: 'center' },
  dayButton: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.72 },
});
