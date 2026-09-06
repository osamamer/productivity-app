import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { localDate } from '@/lib/date';
import {
  averageTimeValues,
  formatDurationValue,
  formatTimeValue,
  timeValueToScale,
} from '@/lib/statValues';
import { api } from '@/services/api';
import { useAppTheme } from '@/providers/ThemeProvider';
import type { StatDefinition, StatEntry, StatSummary } from '@/types/models';
import { AppText } from '../ui/AppText';

interface Props {
  definition: StatDefinition;
  dateRange: number;
  refreshKey: number;
}

interface Period {
  from: string;
  to: string;
}

function periodForRange(dateRange: number): Period {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - dateRange + 1);
  return { from: localDate(from), to: localDate(to) };
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.tile, { borderColor: colors.border, backgroundColor: colors.background }]}>
      <AppText variant="heading" style={styles.value}>{value}</AppText>
      <AppText variant="caption" color="muted" style={styles.label}>{label}</AppText>
    </View>
  );
}

function timePeriodValues(entries: StatEntry[], definition: StatDefinition): { earliest: number | null; average: number | null; latest: number | null } {
  if (entries.length === 0) return { earliest: null, average: null, latest: null };

  const earliest = entries.reduce((current, entry) => (
    timeValueToScale(definition, entry.value) < timeValueToScale(definition, current) ? entry.value : current
  ), entries[0].value);
  const latest = entries.reduce((current, entry) => (
    timeValueToScale(definition, entry.value) > timeValueToScale(definition, current) ? entry.value : current
  ), entries[0].value);
  return { earliest, average: averageTimeValues(definition, entries.map(entry => entry.value)), latest };
}

export function StatSummaryBar({ definition, dateRange, refreshKey }: Props) {
  const period = useMemo(() => periodForRange(dateRange), [dateRange]);
  const dataKey = `${definition.id}:${period.from}:${period.to}`;
  const [data, setData] = useState<{ key: string; summary: StatSummary; entries: StatEntry[] } | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      api.stats.summary(definition.id, period.from, period.to),
      api.stats.entries(definition.id, period.from, period.to),
    ]).then(([summary, entries]) => {
      if (active) setData({ key: dataKey, summary, entries });
    }).catch(cause => {
      console.error('Could not load stat summary:', cause);
      if (active) setData(null);
    });
    return () => { active = false; };
  }, [dataKey, definition.id, period.from, period.to, refreshKey]);

  if (!data || data.key !== dataKey || (definition.type !== 'TIME' && definition.type !== 'DURATION')) return null;

  if (definition.type === 'TIME') {
    const values = timePeriodValues(data.entries, definition);
    return (
      <View style={styles.row}>
        <SummaryTile label="Earliest" value={values.earliest != null ? formatTimeValue(values.earliest) : '—'} />
        <SummaryTile label="Average" value={values.average != null ? formatTimeValue(values.average) : '—'} />
        <SummaryTile label="Latest" value={values.latest != null ? formatTimeValue(values.latest) : '—'} />
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <SummaryTile label="Highest" value={data.summary.periodHighest != null ? formatDurationValue(data.summary.periodHighest) : '—'} />
      <SummaryTile label="Average" value={data.summary.periodAverage != null ? formatDurationValue(data.summary.periodAverage) : '—'} />
      <SummaryTile label="Total" value={data.summary.periodTotal != null ? formatDurationValue(data.summary.periodTotal) : '—'} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, minHeight: 58, borderWidth: 1, borderRadius: 13, paddingHorizontal: 4, paddingVertical: 8, alignItems: 'center', justifyContent: 'center' },
  value: { fontSize: 16, lineHeight: 21, textAlign: 'center' },
  label: { textAlign: 'center', marginTop: 2 },
});
