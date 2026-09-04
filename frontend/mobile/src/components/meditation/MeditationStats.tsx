import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { formatLongDate, localDate } from '@/lib/date';
import { useAppTheme } from '@/providers/ThemeProvider';
import { api } from '@/services/api';
import type { StatDefinition, StatEntry, StatSummary } from '@/types/models';
import { AppText } from '../ui/AppText';
import { Card } from '../ui/Card';
import { SilentPressable } from '../ui/SilentPressable';

const MEDITATED_SYSTEM_KEY = 'meditated';
const MEDITATION_MINUTES_SYSTEM_KEY = 'meditation_minutes';

interface MeditationStatsData {
  meditatedSummary: StatSummary;
  minutesSummary: StatSummary;
  meditatedEntries: StatEntry[];
}

function monthStart(offset: number): Date {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth() + offset, 1);
}

function monthEnd(month: Date): Date {
  return new Date(month.getFullYear(), month.getMonth() + 1, 0);
}

function monthLabel(month: Date): string {
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(month);
}

function daysInMonth(month: Date): Date[] {
  const end = monthEnd(month);
  return Array.from({ length: end.getDate() }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index + 1));
}

function isFuture(date: Date): boolean {
  const today = new Date();
  return date > new Date(today.getFullYear(), today.getMonth(), today.getDate());
}

function formatMinutes(value: number): string {
  const rounded = Math.round(value);
  if (rounded < 60) return `${rounded} min`;
  const hours = Math.floor(rounded / 60);
  const minutes = rounded % 60;
  return minutes === 0 ? `${hours} hr` : `${hours} hr ${minutes} min`;
}

function findSystemDefinition(definitions: StatDefinition[], systemKey: string): StatDefinition | undefined {
  return definitions.find(definition => definition.systemKey === systemKey);
}

export function MeditationStats({ refreshKey }: { refreshKey: number }) {
  const { colors } = useAppTheme();
  const [monthOffset, setMonthOffset] = useState(0);
  const [data, setData] = useState<MeditationStatsData | null>(null);
  const month = useMemo(() => monthStart(monthOffset), [monthOffset]);
  const monthDays = useMemo(() => daysInMonth(month), [month]);
  const from = localDate(month);
  const to = localDate(monthOffset === 0 ? new Date() : monthEnd(month));
  const requestKey = `${from}:${to}:${refreshKey}`;
  const [completedRequestKey, setCompletedRequestKey] = useState<string | null>(null);
  const [errorRequestKey, setErrorRequestKey] = useState<string | null>(null);
  const loading = completedRequestKey !== requestKey && errorRequestKey !== requestKey;
  const error = errorRequestKey === requestKey;

  useEffect(() => {
    let active = true;
    api.stats.definitions()
      .then(definitions => {
        const meditated = findSystemDefinition(definitions, MEDITATED_SYSTEM_KEY);
        const minutes = findSystemDefinition(definitions, MEDITATION_MINUTES_SYSTEM_KEY);
        if (!meditated || !minutes) throw new Error('Meditation statistics are unavailable.');
        return Promise.all([
          api.stats.summary(meditated.id, from, to),
          api.stats.summary(minutes.id, from, to),
          api.stats.entries(meditated.id, from, to),
        ] as const);
      })
      .then(([meditatedSummary, minutesSummary, meditatedEntries]) => {
        if (active) {
          setData({ meditatedSummary, minutesSummary, meditatedEntries });
          setErrorRequestKey(null);
          setCompletedRequestKey(requestKey);
        }
      })
      .catch(cause => {
        console.error('Could not load meditation history:', cause);
        if (active) {
          setErrorRequestKey(requestKey);
          setCompletedRequestKey(requestKey);
        }
      })
      .finally(() => {
        if (active) setCompletedRequestKey(requestKey);
      });
    return () => { active = false; };
  }, [from, month, monthOffset, refreshKey, requestKey, to]);

  const practicedDates = useMemo(
    () => new Set((data?.meditatedEntries ?? []).filter(entry => entry.value === 1).map(entry => entry.date)),
    [data?.meditatedEntries],
  );
  const leadingEmptyDays = (month.getDay() + 6) % 7;
  const calendarDays: (Date | null)[] = [
    ...Array.from({ length: leadingEmptyDays }, () => null),
    ...monthDays,
  ];
  while (calendarDays.length < 42) calendarDays.push(null);
  const yesCount = data?.meditatedSummary.periodYesCount ?? 0;
  const totalMinutes = data?.minutesSummary.periodTotal ?? 0;

  return (
    <Card style={styles.card}>
      <View style={styles.heading}>
        <View style={styles.titleRow}>
          <View style={[styles.icon, { backgroundColor: colors.accentSoft }]}>
            <Ionicons name="leaf" size={21} color={colors.accent} />
          </View>
          <View style={styles.grow}>
            <AppText variant="heading">Your practice</AppText>
            <AppText variant="caption" color="muted">A gentle look back at this month</AppText>
          </View>
        </View>
        <View style={styles.monthControls}>
          <SilentPressable accessibilityRole="button" accessibilityLabel="Previous month" hitSlop={8} onPress={() => setMonthOffset(offset => offset - 1)}>
            <Ionicons name="chevron-back" size={19} color={colors.textMuted} />
          </SilentPressable>
          <AppText variant="caption" color="muted" style={styles.monthLabel}>{monthLabel(month)}</AppText>
          <SilentPressable accessibilityRole="button" accessibilityLabel="Next month" disabled={monthOffset >= 0} hitSlop={8} onPress={() => setMonthOffset(offset => Math.min(0, offset + 1))}>
            <Ionicons name="chevron-forward" size={19} color={monthOffset >= 0 ? colors.border : colors.textMuted} />
          </SilentPressable>
        </View>
      </View>

      <View style={[styles.metrics, { borderColor: colors.border }]}>
        <View style={styles.metric}>
          <View style={styles.metricLabel}><Ionicons name="checkmark-circle-outline" size={16} color={colors.success} /><AppText variant="caption" color="muted">Meditated</AppText></View>
          <AppText variant="title">{yesCount} {yesCount === 1 ? 'day' : 'days'}</AppText>
        </View>
        <View style={[styles.metric, styles.metricDivider, { borderColor: colors.border }]}>
          <View style={styles.metricLabel}><Ionicons name="time-outline" size={16} color={colors.accent} /><AppText variant="caption" color="muted">Meditation minutes</AppText></View>
          <AppText variant="title">{formatMinutes(totalMinutes)}</AppText>
        </View>
      </View>

      {loading && !data ? <AppText variant="caption" color="muted">Loading your practice…</AppText> : null}
      {error && !data ? <AppText variant="caption" color="danger">Your meditation history could not be loaded.</AppText> : null}
      <View>
        <View style={styles.calendarTitle}>
          <AppText variant="label">Practice calendar</AppText>
          <AppText variant="caption" color="muted">Mon – Sun</AppText>
        </View>
        <View style={[styles.calendar, { borderTopColor: colors.border, borderLeftColor: colors.border }]}>
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => (
            <View key={`${day}-${index}`} style={[styles.calendarCell, { backgroundColor: colors.surface, borderRightColor: colors.border, borderBottomColor: colors.border }]}>
              <AppText variant="caption" color="muted">{day}</AppText>
            </View>
          ))}
          {calendarDays.map((date, index) => {
            if (!date) return <View key={`empty-${index}`} style={[styles.calendarCell, { backgroundColor: colors.surface, borderRightColor: colors.border, borderBottomColor: colors.border }]} />;
            const practiced = !isFuture(date) && practicedDates.has(localDate(date));
            return (
              <View key={localDate(date)} style={[styles.calendarCell, { backgroundColor: practiced ? `${colors.success}2E` : colors.surface, borderRightColor: colors.border, borderBottomColor: colors.border }, isFuture(date) && styles.futureDay]}>
                <AppText variant="caption" style={practiced ? { color: colors.success } : undefined}>{date.getDate()}</AppText>
              </View>
            );
          })}
        </View>
        <View style={styles.legend}>
          <View style={styles.legendItem}><View style={[styles.legendMark, { backgroundColor: `${colors.success}2E` }]} /><AppText variant="caption" color="muted">Meditated</AppText></View>
          <View style={styles.legendItem}><View style={[styles.legendMark, { borderColor: colors.border }]} /><AppText variant="caption" color="muted">No session</AppText></View>
        </View>
      </View>
      <AppText variant="caption" color="muted" style={styles.updated}>Today is {formatLongDate()}.</AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 18 },
  heading: { gap: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  grow: { flex: 1, gap: 2 },
  monthControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  monthLabel: { textAlign: 'center', flex: 1 },
  metrics: { flexDirection: 'row', borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  metric: { flex: 1, padding: 13, gap: 7 },
  metricDivider: { borderLeftWidth: 1 },
  metricLabel: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  calendarTitle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 },
  calendar: { flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1, borderLeftWidth: 1, borderRadius: 12, overflow: 'hidden' },
  calendarCell: { width: `${100 / 7}%`, height: 37, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderBottomWidth: 1, gap: 1 },
  futureDay: { opacity: 0.42 },
  legend: { flexDirection: 'row', gap: 16, marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendMark: { width: 13, height: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  updated: { marginTop: -7 },
});
