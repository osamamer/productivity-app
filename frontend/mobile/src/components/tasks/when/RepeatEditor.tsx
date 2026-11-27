import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  sortWeekdays,
  upcomingOccurrenceDates,
  WEEKDAYS,
  weekdayOfDateKey,
  type RepeatKind,
  type RepeatRule,
  type Weekday,
} from '../../../../../shared/repeatRule';
import { formatShortDate } from '@/lib/date';
import { useAppTheme } from '@/providers/ThemeProvider';
import { AppText } from '../../ui/AppText';
import { ChoiceChips } from '../../ui/ChoiceChips';
import { SilentPressable } from '../../ui/SilentPressable';
import { DateOnlyField } from './DateOnlyField';

const KINDS = [
  { value: 'NONE' as const, label: 'Never' },
  { value: 'DAILY' as const, label: 'Daily' },
  { value: 'WEEKLY' as const, label: 'Weekly' },
  { value: 'MONTHLY' as const, label: 'Monthly' },
];

const UNIT = { DAILY: ['day', 'days'], WEEKLY: ['week', 'weeks'], MONTHLY: ['month', 'months'] } as const;

/** Never, Daily, Weekly or Monthly, every N, weekdays for Weekly, an end date and the next few dates. */
export function RepeatEditor({ value, onChange, startDate, children }: {
  value: RepeatRule;
  onChange: (value: RepeatRule) => void;
  /** `YYYY-MM-DD` the repeat starts from; without it nothing can repeat. */
  startDate: string;
  children?: ReactNode;
}) {
  const { colors } = useAppTheme();
  const update = (changes: Partial<RepeatRule>) => onChange({ ...value, ...changes });
  const selectKind = (kind: RepeatKind) => {
    if (kind === value.kind) return;
    const days = kind === 'WEEKLY' && startDate ? [weekdayOfDateKey(startDate)] : [];
    onChange({ kind, every: 1, days, until: kind === 'NONE' ? null : value.until });
  };
  const toggleDay = (day: Weekday) => {
    const days = value.days.includes(day) ? value.days.filter(item => item !== day) : [...value.days, day];
    update({ days: sortWeekdays(days) });
  };

  if (!startDate) {
    return <AppText color="muted">Pick a date first, then choose how it repeats.</AppText>;
  }
  const upcoming = upcomingOccurrenceDates(value, startDate, startDate, 3);

  return (
    <View style={styles.container}>
      <ChoiceChips value={value.kind} onChange={selectKind} options={KINDS} />
      {value.kind !== 'NONE' && (
        <>
          {value.kind === 'WEEKLY' && (
            <View style={styles.section}>
              <AppText variant="caption" color="muted">On</AppText>
              <View style={styles.days} accessibilityRole="radiogroup" accessibilityLabel="Repeat on">
                {WEEKDAYS.map(day => {
                  const selected = value.days.includes(day);
                  return (
                    <SilentPressable
                      key={day}
                      accessibilityRole="checkbox"
                      accessibilityLabel={day.charAt(0) + day.slice(1).toLowerCase()}
                      accessibilityState={{ checked: selected }}
                      onPress={() => toggleDay(day)}
                      style={[
                        styles.day,
                        { borderColor: selected ? colors.accent : colors.border, backgroundColor: selected ? colors.accent : 'transparent' },
                      ]}>
                      <AppText variant="label" style={{ color: selected ? colors.background : colors.textMuted }}>{day.charAt(0)}</AppText>
                    </SilentPressable>
                  );
                })}
              </View>
            </View>
          )}
          <View style={styles.everyRow}>
            <AppText variant="label">Every</AppText>
            <Stepper icon="remove" label="Fewer" disabled={value.every <= 1}
              onPress={() => update({ every: Math.max(1, value.every - 1) })} />
            <AppText variant="heading" style={styles.everyValue}>{value.every}</AppText>
            <Stepper icon="add" label="More" disabled={value.every >= 999}
              onPress={() => update({ every: Math.min(999, value.every + 1) })} />
            <AppText variant="label">{UNIT[value.kind][value.every === 1 ? 0 : 1]}</AppText>
          </View>
          <DateOnlyField label="Until" emptyLabel="Forever" value={value.until} minDate={startDate}
            onChange={until => update({ until })} />
          {children}
          {upcoming.length > 0 && (
            <AppText variant="caption" color="muted">Next: {upcoming.map(date => formatShortDate(date)).join(', ')}</AppText>
          )}
        </>
      )}
    </View>
  );
}

function Stepper({ icon, label, disabled, onPress }: {
  icon: 'add' | 'remove';
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <SilentPressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }}
      disabled={disabled} onPress={onPress} hitSlop={6}
      style={[styles.stepper, { borderColor: colors.border, opacity: disabled ? 0.4 : 1 }]}>
      <Ionicons name={icon} size={18} color={colors.text} />
    </SilentPressable>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14 },
  section: { gap: 6 },
  days: { flexDirection: 'row', justifyContent: 'space-between' },
  day: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  everyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  everyValue: { minWidth: 28, textAlign: 'center' },
  stepper: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
