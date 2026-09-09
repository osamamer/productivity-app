import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { formatShortDate, formatTime, localDateTime } from '@/lib/date';
import { useAppTheme } from '@/providers/ThemeProvider';
import { AppButton } from '../ui/AppButton';
import { CalendarDatePicker } from '../ui/CalendarDatePicker';
import { AppPopup } from '../ui/AppPopup';
import { AppText } from '../ui/AppText';
import { SilentPressable } from '../ui/SilentPressable';

const pad = (value: number) => String(value).padStart(2, '0');

export function dateFromScheduleValue(value: string | null | undefined): Date {
  if (value) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

function TimeColumn({ label, values, selected, onSelect }: {
  label: string;
  values: number[];
  selected: number;
  onSelect: (value: number) => void;
}) {
  const { colors } = useAppTheme();
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const selectedIndex = values.indexOf(selected);
    if (selectedIndex < 0) return;
    const optionHeight = 40;
    const optionGap = 7;
    const viewportHeight = 180;
    const targetOffset = Math.max(0, selectedIndex * (optionHeight + optionGap) - (viewportHeight - optionHeight) / 2);
    const focusTimer = setTimeout(() => scrollRef.current?.scrollTo({ y: targetOffset, animated: false }), 0);
    return () => clearTimeout(focusTimer);
  }, [selected, values]);

  return (
    <View style={styles.timeColumn}>
      <AppText variant="caption" color="muted" style={styles.timeLabel}>{label}</AppText>
      <ScrollView ref={scrollRef} style={styles.timeScroll} contentContainerStyle={styles.timeOptions} showsVerticalScrollIndicator={false}>
        {values.map(value => {
          const selectedValue = value === selected;
          return (
            <SilentPressable
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
            </SilentPressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function TimePicker({ value, onChange }: { value: Date; onChange: (value: Date) => void }) {
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

export function TaskDateTimePicker({ value, onChange, timeOnly = false }: {
  value: Date;
  onChange: (value: Date) => void;
  timeOnly?: boolean;
}) {
  const { colors } = useAppTheme();

  return (
    <>
      {!timeOnly && <CalendarDatePicker value={value} onChange={onChange} />}
      {!timeOnly && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
      <AppText variant="label">Time</AppText>
      <TimePicker value={value} onChange={onChange} />
    </>
  );
}

export function TaskScheduleField({ value, onChange, timeOnly = false, style }: {
  value: string | null | undefined;
  onChange: (value: string) => void;
  timeOnly?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useAppTheme();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => dateFromScheduleValue(value));
  const hasSchedule = Boolean(value && !Number.isNaN(new Date(value).getTime()));
  const displayedValue = hasSchedule
    ? timeOnly ? formatTime(value) : `${formatShortDate(value)} · ${formatTime(value)}`
    : 'Not scheduled';

  function openPicker() {
    setDraft(dateFromScheduleValue(value));
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
    <View style={[styles.container, style]}>
      <View style={styles.heading}>
        <AppText variant="label">{timeOnly ? 'Scheduled time' : 'Scheduled'}</AppText>
        {hasSchedule && !timeOnly && (
          <SilentPressable
            accessibilityRole="button"
            accessibilityLabel="Clear scheduled date and time"
            hitSlop={8}
            onPress={clear}
            style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}>
            <Ionicons name="close-circle-outline" size={17} color={colors.textMuted} />
            <AppText variant="caption" color="muted">Clear</AppText>
          </SilentPressable>
        )}
      </View>
      <SilentPressable
        accessibilityRole="button"
        accessibilityLabel={`Scheduled: ${displayedValue}`}
        onPress={openPicker}
        style={({ pressed }) => [styles.field, { borderColor: colors.border, backgroundColor: colors.background }, pressed && styles.pressed]}>
        <Ionicons name="calendar-outline" size={19} color={colors.accent} />
        <AppText variant="label" color={hasSchedule ? 'default' : 'muted'} style={styles.fieldValue}>
          {displayedValue}
        </AppText>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </SilentPressable>
      <AppPopup
        visible={open}
        title={timeOnly ? 'Scheduled time' : 'Scheduled'}
        showIcon={false}
        onClose={() => setOpen(false)}
        dismissOnBackdrop={false}
        footer={(
          <View style={styles.popupActions}>
            <AppButton style={styles.popupAction} variant="secondary" label="Cancel" onPress={() => setOpen(false)} />
            <AppButton style={styles.popupAction} label="Done" onPress={save} />
          </View>
        )}>
        <TaskDateTimePicker key={`${open}-${value ?? ''}-${timeOnly}`} value={draft} onChange={setDraft} timeOnly={timeOnly} />
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
