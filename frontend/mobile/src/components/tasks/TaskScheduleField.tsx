import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { formatShortDate, formatTime, localDateTime } from '@/lib/date';
import { useAppTheme } from '@/providers/ThemeProvider';
import { AppButton } from '../ui/AppButton';
import { AppPopup } from '../ui/AppPopup';
import { AppText } from '../ui/AppText';

const pad = (value: number) => String(value).padStart(2, '0');

function dateFromValue(value: string | null | undefined): Date {
  if (value) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

function monthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function sameCalendarDay(first: Date, second: Date): boolean {
  return first.getFullYear() === second.getFullYear()
    && first.getMonth() === second.getMonth()
    && first.getDate() === second.getDate();
}

function CalendarPicker({ value, onChange }: { value: Date; onChange: (value: Date) => void }) {
  const { colors } = useAppTheme();
  const [month, setMonth] = useState(() => monthStart(value));

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
    <View style={styles.calendar}>
      <View style={styles.calendarHeader}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          hitSlop={8}
          onPress={() => setMonth(current => new Date(current.getFullYear(), current.getMonth() - 1, 1))}>
          <Ionicons name="chevron-back" size={20} color={colors.textMuted} />
        </Pressable>
        <AppText variant="label">{monthLabel}</AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next month"
          hitSlop={8}
          onPress={() => setMonth(current => new Date(current.getFullYear(), current.getMonth() + 1, 1))}>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </Pressable>
      </View>
      <View style={styles.weekdays}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
          <AppText key={`${day}-${index}`} variant="caption" color="muted" style={styles.dayLabel}>
            {day}
          </AppText>
        ))}
      </View>
      <View style={styles.calendarGrid}>
        {days.map((day, index) => day ? (
          <Pressable
            key={day.toISOString()}
            accessibilityRole="button"
            accessibilityLabel={day.toLocaleDateString()}
            onPress={() => onChange(day)}
            style={styles.day}>
            <View style={[styles.dayButton, sameCalendarDay(day, value) && { backgroundColor: colors.accent }]}>
              <AppText variant="label" style={{ color: sameCalendarDay(day, value) ? colors.onAccent : colors.text }}>
                {day.getDate()}
              </AppText>
            </View>
          </Pressable>
        ) : <View key={`empty-${index}`} style={styles.day} />)}
      </View>
    </View>
  );
}

function TimeColumn({ label, values, selected, onSelect }: {
  label: string;
  values: number[];
  selected: number;
  onSelect: (value: number) => void;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.timeColumn}>
      <AppText variant="caption" color="muted" style={styles.timeLabel}>{label}</AppText>
      <ScrollView style={styles.timeScroll} contentContainerStyle={styles.timeOptions} showsVerticalScrollIndicator={false}>
        {values.map(value => {
          const selectedValue = value === selected;
          return (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityState={{ selected: selectedValue }}
              onPress={() => onSelect(value)}
              style={[styles.timeOption, {
                backgroundColor: selectedValue ? colors.accent : colors.background,
                borderColor: selectedValue ? colors.accent : colors.border,
              }]}>
              <AppText variant="label" style={{ color: selectedValue ? colors.onAccent : colors.text }}>
                {pad(value)}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function TimePicker({ value, onChange }: { value: Date; onChange: (value: Date) => void }) {
  const hours = Array.from({ length: 24 }, (_, value) => value);
  const minutes = Array.from({ length: 60 }, (_, value) => value);

  function update(hoursValue: number, minutesValue: number) {
    const next = new Date(value);
    next.setHours(hoursValue, minutesValue, 0, 0);
    onChange(next);
  }

  return (
    <View style={styles.timePicker}>
      <TimeColumn
        label="HOUR"
        values={hours}
        selected={value.getHours()}
        onSelect={hoursValue => update(hoursValue, value.getMinutes())}
      />
      <TimeColumn
        label="MINUTE"
        values={minutes}
        selected={value.getMinutes()}
        onSelect={minutesValue => update(value.getHours(), minutesValue)}
      />
    </View>
  );
}

export function TaskScheduleField({ value, onChange }: {
  value: string | null | undefined;
  onChange: (value: string) => void;
}) {
  const { colors } = useAppTheme();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => dateFromValue(value));
  const hasSchedule = Boolean(value && !Number.isNaN(new Date(value).getTime()));
  const displayedValue = hasSchedule
    ? `${formatShortDate(value)} · ${formatTime(value)}`
    : 'Not scheduled';

  function openPicker() {
    setDraft(dateFromValue(value));
    setOpen(true);
  }

  function save() {
    onChange(localDateTime(draft));
    setOpen(false);
  }

  function clear() {
    setOpen(false);
    onChange('');
  }

  return (
    <View style={styles.container}>
      <View style={styles.heading}>
        <AppText variant="label">Scheduled</AppText>
        {hasSchedule && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear scheduled date and time"
            hitSlop={8}
            onPress={clear}
            style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}>
            <Ionicons name="close-circle-outline" size={17} color={colors.textMuted} />
            <AppText variant="caption" color="muted">Clear</AppText>
          </Pressable>
        )}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Scheduled: ${displayedValue}`}
        onPress={openPicker}
        style={({ pressed }) => [styles.field, { borderColor: colors.border, backgroundColor: colors.background }, pressed && styles.pressed]}>
        <Ionicons name="calendar-outline" size={19} color={colors.accent} />
        <AppText variant="label" color={hasSchedule ? 'default' : 'muted'} style={styles.fieldValue}>
          {displayedValue}
        </AppText>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressable>
      <AppPopup
        visible={open}
        title="Scheduled"
        showIcon={false}
        onClose={() => setOpen(false)}
        dismissOnBackdrop={false}
        footer={(
          <View style={styles.popupActions}>
            <AppButton style={styles.popupAction} variant="secondary" label="Cancel" onPress={() => setOpen(false)} />
            <AppButton style={styles.popupAction} label="Done" onPress={save} />
          </View>
        )}>
        <CalendarPicker key={`${open}-${value ?? ''}`} value={draft} onChange={setDraft} />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <AppText variant="label">Time</AppText>
        <TimePicker value={draft} onChange={setDraft} />
      </AppPopup>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  clearButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  field: { minHeight: 58, paddingHorizontal: 13, paddingVertical: 10, borderWidth: 1, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  fieldValue: { flex: 1 },
  calendar: { gap: 13 },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  weekdays: { flexDirection: 'row' },
  dayLabel: { flex: 1, textAlign: 'center' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 7 },
  day: { width: '14.2857%', height: 40, alignItems: 'center', justifyContent: 'center' },
  dayButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  timePicker: { flexDirection: 'row', gap: 12 },
  timeColumn: { flex: 1, gap: 8 },
  timeLabel: { textAlign: 'center' },
  timeScroll: { height: 180 },
  timeOptions: { gap: 7 },
  timeOption: { minHeight: 40, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  divider: { height: 1 },
  popupActions: { flexDirection: 'row', gap: 10 },
  popupAction: { flex: 1 },
  pressed: { opacity: 0.72 },
});
