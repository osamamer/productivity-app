import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { localDate, formatShortDate } from '@/lib/date';
import { useAppTheme } from '@/providers/ThemeProvider';
import { api } from '@/services/api';
import type { StatDefinition, StatEntry } from '@/types/models';
import { AppText } from '../ui/AppText';

const RECENT_DAYS = 5;
const PLOT_HEIGHT = 108;
const PLOT_VERTICAL_INSET = 12;
const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

type NumericDomain = [number, number];
interface ChartPoint { x: number; y: number; value: number; }

function calendarWeeks(dates: string[]): (string | null)[][] {
  if (dates.length === 0) return [];
  const firstDay = new Date(`${dates[0]}T12:00:00`);
  const leadingEmptyDays = (firstDay.getDay() + 6) % 7;
  const calendarDays: (string | null)[] = [
    ...Array<string | null>(leadingEmptyDays).fill(null),
    ...dates,
  ];
  while (calendarDays.length % 7 !== 0) calendarDays.push(null);
  const weeks: (string | null)[][] = [];
  for (let index = 0; index < calendarDays.length; index += 7) {
    weeks.push(calendarDays.slice(index, index + 7));
  }
  return weeks;
}

function datesForLastDays(days: number): string[] {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (days - 1 - index));
    return localDate(date);
  });
}

function chartBuckets(dates: string[], dateRange: number): string[][] {
  if (dateRange <= 7) return dates.map(date => [date]);

  if (dateRange <= 30) {
    const buckets: string[][] = [];
    for (let index = 0; index < dates.length; index += 3) buckets.push(dates.slice(index, index + 3));
    return buckets;
  }

  if (dateRange <= 90) {
    const buckets: string[][] = [];
    for (let index = 0; index < dates.length; index += 7) buckets.push(dates.slice(index, index + 7));
    return buckets;
  }

  const buckets: string[][] = [];
  dates.forEach(date => {
    const month = date.slice(0, 7);
    const bucket = buckets[buckets.length - 1];
    if (!bucket || bucket[0].slice(0, 7) !== month) buckets.push([date]);
    else bucket.push(date);
  });
  return buckets;
}

function effectiveMorality(definition: StatDefinition): 'GOOD' | 'BAD' | 'NEUTRAL' {
  return definition.morality ?? 'NEUTRAL';
}

function mixHexColors(first: string, second: string, firstWeight: number): string {
  const parse = (color: string) => {
    const hex = color.replace('#', '');
    if (!/^(?:[\da-f]{3}|[\da-f]{6})$/i.test(hex)) return null;
    const expanded = hex.length === 3 ? hex.split('').map(value => value + value).join('') : hex;
    return [0, 2, 4].map(index => parseInt(expanded.slice(index, index + 2), 16));
  };
  const firstRgb = parse(first);
  const secondRgb = parse(second);
  if (!firstRgb || !secondRgb) return first;
  const weight = Math.max(0, Math.min(1, firstWeight));
  const channels = firstRgb.map((channel, index) => Math.round(channel * weight + secondRgb[index] * (1 - weight)));
  return `rgb(${channels.join(', ')})`;
}

function thresholdCircleColor(definition: StatDefinition, value: number, surface: string, success: string, danger: string): string | null {
  if ((definition.type !== 'NUMBER' && definition.type !== 'RANGE')
    || definition.goodThreshold == null
    || !Number.isFinite(definition.goodThreshold)) return null;

  const morality = effectiveMorality(definition);
  if (morality === 'NEUTRAL') return null;

  const threshold = definition.goodThreshold;
  const goodnessRatio = threshold > 0
    ? morality === 'GOOD' ? value / threshold : value <= 0 ? 3 : threshold / value
    : 1 + (morality === 'GOOD' ? value - threshold : threshold - value) / Math.max(Math.abs(threshold), 1);

  if (goodnessRatio >= 1) {
    const progressToMaximum = Math.min(1, (goodnessRatio - 1) / 2);
    const greenWeight = 0.55 + progressToMaximum * 0.45;
    return mixHexColors(success, surface, greenWeight);
  }

  const redWeight = 0.55 + Math.min(0.45, (1 - goodnessRatio) * 0.6);
  return mixHexColors(danger, surface, redWeight);
}

function getCircleColor(definition: StatDefinition, value: number | undefined, colors: ReturnType<typeof useAppTheme>['colors'], dark: boolean): string {
  if (value === undefined) return dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';

  const thresholdColor = thresholdCircleColor(definition, value, colors.surface, colors.success, colors.danger);
  if (thresholdColor) return thresholdColor;

  const morality = effectiveMorality(definition);
  const feedback = morality === 'NEUTRAL'
    ? 'NONE'
    : definition.type === 'BOOLEAN'
      ? morality === 'GOOD' ? value === 1 ? 'CELEBRATE' : 'NONE' : value === 1 ? 'SAD' : 'CELEBRATE'
      : definition.goodThreshold == null
        ? 'NONE'
        : morality === 'GOOD'
          ? value >= definition.goodThreshold ? 'CELEBRATE' : 'NONE'
          : value <= definition.goodThreshold ? 'CELEBRATE' : 'SAD';

  if (feedback === 'CELEBRATE') return colors.success;
  if (feedback === 'SAD') return colors.danger;

  if (morality === 'NEUTRAL') {
    if (definition.type === 'BOOLEAN') return value === 1 ? colors.accent : colors.secondary;
    if (definition.type === 'RANGE') {
      const minimum = definition.minValue ?? 0;
      const maximum = definition.maxValue ?? 1;
      const ratio = maximum === minimum ? 0 : Math.max(0, Math.min(1, (value - minimum) / (maximum - minimum)));
      return mixHexColors(colors.secondary, colors.accent, 1 - ratio);
    }
  }

  if (definition.type === 'BOOLEAN') return value === 1 ? colors.success : colors.danger;
  if (definition.type === 'RANGE') {
    const minimum = definition.minValue ?? 0;
    const maximum = definition.maxValue ?? 1;
    const ratio = maximum === minimum ? 0 : Math.max(0, Math.min(1, (value - minimum) / (maximum - minimum)));
    return `hsl(${Math.round(ratio * 120)}, 65%, 42%)`;
  }
  return dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
}

function formatCircleValue(value: number): string {
  if (Math.abs(value) >= 10000) return `${Math.round(value / 1000)}k`;
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}k`;
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1);
}

function chartDomain(definition: StatDefinition, values: number[]): NumericDomain {
  if (definition.type === 'BOOLEAN') return [0, 1];
  const finiteValues = values.filter(Number.isFinite);
  if (definition.type === 'RANGE') {
    if (Number.isFinite(definition.minValue)) finiteValues.push(definition.minValue!);
    if (Number.isFinite(definition.maxValue)) finiteValues.push(definition.maxValue!);
  }
  if (definition.goodThreshold != null && effectiveMorality(definition) !== 'NEUTRAL') {
    finiteValues.push(definition.goodThreshold);
  }
  if (finiteValues.length === 0) return [0, 1];

  const minimum = Math.min(...finiteValues);
  const maximum = Math.max(...finiteValues);
  if (minimum >= 0) return [0, maximum === 0 ? 1 : maximum * 1.1];
  if (maximum <= 0) return [minimum * 1.1, 0];
  const padding = (maximum - minimum) * 0.1;
  return [minimum - padding, maximum + padding];
}

function formatChartValue(value: number): string {
  return Number.isInteger(value) ? String(value) : Number(value.toFixed(1)).toString();
}

interface ChartSegment {
  start: ChartPoint;
  end: ChartPoint;
}

function cubicPoint(start: ChartPoint, controlOne: ChartPoint, controlTwo: ChartPoint, end: ChartPoint, t: number): ChartPoint {
  const inverse = 1 - t;
  return {
    x: inverse ** 3 * start.x
      + 3 * inverse ** 2 * t * controlOne.x
      + 3 * inverse * t ** 2 * controlTwo.x
      + t ** 3 * end.x,
    y: inverse ** 3 * start.y
      + 3 * inverse ** 2 * t * controlOne.y
      + 3 * inverse * t ** 2 * controlTwo.y
      + t ** 3 * end.y,
    value: end.value,
  };
}

function curvedSegments(points: ChartPoint[]): ChartSegment[] {
  const segments: ChartSegment[] = [];
  const sampleCount = 8;

  points.slice(1).forEach((end, index) => {
    const start = points[index];
    const previous = points[index - 1] ?? start;
    const next = points[index + 2] ?? end;
    const clampY = (value: number) => Math.max(PLOT_VERTICAL_INSET, Math.min(PLOT_HEIGHT - PLOT_VERTICAL_INSET, value));
    const controlOne = {
      x: start.x + (end.x - previous.x) / 6,
      y: clampY(start.y + (end.y - previous.y) / 6),
      value: start.value,
    };
    const controlTwo = {
      x: end.x - (next.x - start.x) / 6,
      y: clampY(end.y - (next.y - start.y) / 6),
      value: end.value,
    };

    let segmentStart = start;
    for (let sample = 1; sample <= sampleCount; sample += 1) {
      const segmentEnd = cubicPoint(start, controlOne, controlTwo, end, sample / sampleCount);
      segments.push({ start: segmentStart, end: segmentEnd });
      segmentStart = segmentEnd;
    }
  });

  return segments;
}

export function StatHistoryPreview({ definition, todayEntry, dateRange, refreshKey, header }: {
  definition: StatDefinition;
  todayEntry?: StatEntry;
  dateRange: number;
  refreshKey: number;
  header?: ReactNode;
}) {
  const { colors, dark } = useAppTheme();
  const dates = useMemo(() => datesForLastDays(dateRange), [dateRange]);
  const [entries, setEntries] = useState<StatEntry[]>([]);
  const requestKey = `${definition.id}:${dates[0]}:${dates[dates.length - 1]}:${refreshKey}`;
  const [completedRequestKey, setCompletedRequestKey] = useState<string | null>(null);
  const [errorRequestKey, setErrorRequestKey] = useState<string | null>(null);
  const loading = completedRequestKey !== requestKey && errorRequestKey !== requestKey;
  const error = errorRequestKey === requestKey;

  useEffect(() => {
    let active = true;
    api.stats.entries(definition.id, dates[0], dates[dates.length - 1])
      .then(nextEntries => {
        if (active) {
          setEntries(nextEntries);
          setErrorRequestKey(null);
          setCompletedRequestKey(requestKey);
        }
      })
      .catch(cause => {
        console.error('Could not load stat history:', cause);
        if (active) {
          setErrorRequestKey(requestKey);
          setCompletedRequestKey(requestKey);
        }
      })
      .finally(() => {
        if (active) setCompletedRequestKey(requestKey);
      });
    return () => { active = false; };
  }, [definition.id, dates, requestKey]);

  const entriesByDate = useMemo(() => {
    const map = new Map(entries.map(entry => [entry.date, entry.value]));
    if (todayEntry) map.set(todayEntry.date, todayEntry.value);
    return map;
  }, [entries, todayEntry]);
  const recentDates = dates.slice(-RECENT_DAYS);
  const buckets = useMemo(() => chartBuckets(dates, dateRange), [dates, dateRange]);
  const recordedValues = Array.from(entriesByDate.values());
  const hasHistory = recordedValues.length > 0;
  const domain = chartDomain(definition, recordedValues);
  const [plotWidth, setPlotWidth] = useState(0);
  const chartPoints = useMemo(() => {
    const span = domain[1] - domain[0] || 1;
    return buckets
      .map((bucket, index) => {
        const values = bucket
          .map(date => entriesByDate.get(date) ?? (definition.type === 'BOOLEAN' ? 0 : undefined))
          .filter((value): value is number => value !== undefined);
        const value = values.length > 0 ? values.reduce((total, item) => total + item, 0) / values.length : undefined;
        if (value === undefined || !hasHistory) return undefined;
        const ratio = Math.max(0, Math.min(1, (value - domain[0]) / span));
        return {
          x: buckets.length === 1 ? 0 : (index / (buckets.length - 1)) * plotWidth,
          y: PLOT_VERTICAL_INSET + (1 - ratio) * (PLOT_HEIGHT - PLOT_VERTICAL_INSET * 2),
          value,
        };
      })
      .filter((point): point is ChartPoint => point !== undefined);
  }, [buckets, definition.type, domain, entriesByDate, hasHistory, plotWidth]);
  const chartSegments = useMemo(() => curvedSegments(chartPoints), [chartPoints]);
  const calendar = useMemo(() => calendarWeeks(dates), [dates]);

  if (definition.type === 'BOOLEAN') {
    const yesColor = getCircleColor(definition, 1, colors, dark);
    const noColor = getCircleColor(definition, 0, colors, dark);
    const cellHeight = dateRange <= 30 ? 27 : dateRange <= 90 ? 16 : 9;

    return (
      <View style={styles.history}>
        <View style={styles.compactHeader}>
          {header && <View style={styles.headerSlot}>{header}</View>}
          {loading && <ActivityIndicator size="small" color={colors.accent} />}
        </View>
        <View style={styles.booleanCalendar} accessibilityLabel={`${definition.name} calendar`}>
          <View style={styles.calendarWeek}>
            {WEEKDAY_LABELS.map((label, index) => (
              <AppText key={`${label}-${index}`} variant="caption" color="muted" style={styles.calendarWeekday}>
                {label}
              </AppText>
            ))}
          </View>
          <View style={styles.calendarGrid}>
            {calendar.map((week, weekIndex) => (
              <View key={`week-${weekIndex}`} style={styles.calendarWeek}>
                {week.map((date, dayIndex) => {
                  const value = date ? entriesByDate.get(date) : undefined;
                  return (
                    <View
                      key={date ?? `empty-${weekIndex}-${dayIndex}`}
                      accessible={Boolean(date)}
                      accessibilityLabel={date ? `${date}: ${value === undefined ? 'Not recorded' : value === 1 ? 'Yes' : 'No'}` : undefined}
                      style={[
                        styles.calendarCell,
                        { height: cellHeight },
                        date && value === undefined && { backgroundColor: `${colors.border}35` },
                        date && value === 1 && { backgroundColor: yesColor },
                        date && value === 0 && { backgroundColor: noColor },
                      ]}
                    />
                  );
                })}
              </View>
            ))}
          </View>
        </View>
        <View style={styles.calendarFooter}>
          <View style={styles.calendarLegend}>
            <View style={[styles.legendSwatch, { backgroundColor: yesColor }]} />
            <AppText variant="caption" color="muted">Yes</AppText>
            <View style={[styles.legendSwatch, { backgroundColor: noColor }]} />
            <AppText variant="caption" color="muted">No</AppText>
          </View>
          {error ? (
            <AppText variant="caption" color="danger">History unavailable</AppText>
          ) : (
            <AppText variant="caption" color="muted">
              {formatShortDate(dates[0])} – {formatShortDate(dates[dates.length - 1])}
            </AppText>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.history}>
      <View style={styles.compactHeader}>
        {header && <View style={styles.headerSlot}>{header}</View>}
        <View style={styles.recentDots}>
          {recentDates.map(date => {
            const value = entriesByDate.get(date);
            const isUnboundedNumber = definition.type === 'NUMBER';
            return (
              <View
                key={date}
                accessible
                accessibilityLabel={`${date}: ${value === undefined ? 'No entry' : String(value)}`}
                style={[
                  styles.dot,
                  { backgroundColor: getCircleColor(definition, value, colors, dark) },
                  isUnboundedNumber && value === undefined && { borderColor: colors.border, borderStyle: 'dashed', borderWidth: 1 },
              ]}>
                {isUnboundedNumber && value !== undefined && (
                  <AppText variant="caption" style={styles.dotValue}>{formatCircleValue(value)}</AppText>
                )}
              </View>
            );
          })}
        </View>
        {loading && <ActivityIndicator size="small" color={colors.accent} />}
      </View>

      <View style={[styles.chart, !hasHistory && styles.chartEmpty]}>
        <View style={styles.chartAxis}>
          <AppText variant="caption" color="muted">{formatChartValue(domain[1])}</AppText>
          <AppText variant="caption" color="muted">{formatChartValue(domain[0])}</AppText>
        </View>
        <View onLayout={event => setPlotWidth(event.nativeEvent.layout.width)} style={styles.plot}>
          {[0, 50, 100].map(position => (
            <View key={position} style={[styles.gridLine, { top: `${position}%`, backgroundColor: colors.border }]} />
          ))}
          {chartSegments.map((segment, index) => {
            const width = Math.hypot(segment.end.x - segment.start.x, segment.end.y - segment.start.y);
            const angle = Math.atan2(segment.end.y - segment.start.y, segment.end.x - segment.start.x) * (180 / Math.PI);
            return (
              <View
                key={`${index}-${segment.end.x}`}
                style={[styles.segment, {
                  width,
                  left: (segment.start.x + segment.end.x) / 2 - width / 2,
                  top: (segment.start.y + segment.end.y) / 2 - 1,
                  backgroundColor: colors.accent,
                  transform: [{ rotate: `${angle}deg` }],
                }]}
              />
            );
          })}
          {chartPoints.map((point, index) => (
            <View key={`${index}-${point.x}-point`} style={[styles.plotPoint, { left: point.x - 3, top: point.y - 3, backgroundColor: colors.accent }]} />
          ))}
        </View>
      </View>
      {error ? (
        <AppText variant="caption" color="danger">History unavailable</AppText>
      ) : !hasHistory ? (
        <AppText variant="caption" color="muted">No history yet</AppText>
      ) : (
        <View style={styles.dateLabels}>
          <AppText variant="caption" color="muted">{formatShortDate(dates[0])}</AppText>
          <AppText variant="caption" color="muted">{formatShortDate(dates[dates.length - 1])}</AppText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  history: { gap: 8 },
  compactHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerSlot: { flex: 1, minWidth: 0 },
  recentDots: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  dotValue: { fontSize: 9, lineHeight: 10, fontWeight: '700' },
  booleanCalendar: { gap: 4 },
  calendarGrid: { gap: 4 },
  calendarWeek: { flexDirection: 'row', gap: 4 },
  calendarWeekday: { flex: 1, textAlign: 'center', fontSize: 10, lineHeight: 13 },
  calendarCell: { flex: 1, borderRadius: 5 },
  calendarFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  calendarLegend: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendSwatch: { width: 8, height: 8, borderRadius: 3, marginLeft: 4 },
  chart: { flexDirection: 'row', height: PLOT_HEIGHT, gap: 8 },
  chartEmpty: { opacity: 0.55 },
  chartAxis: { width: 34, justifyContent: 'space-between', alignItems: 'flex-end', paddingVertical: 3 },
  plot: { flex: 1, height: PLOT_HEIGHT, overflow: 'hidden', position: 'relative', borderRadius: 8 },
  gridLine: { position: 'absolute', left: 0, right: 0, height: 1 },
  segment: { height: 2, position: 'absolute', borderRadius: 1 },
  plotPoint: { position: 'absolute', width: 6, height: 6, borderRadius: 3 },
  dateLabels: { flexDirection: 'row', justifyContent: 'space-between' },
});
