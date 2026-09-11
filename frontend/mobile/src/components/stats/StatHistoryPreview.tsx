import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { formatShortDate, formatWeekday, localDate } from '@/lib/date';
import { useAppTheme } from '@/providers/ThemeProvider';
import { api } from '@/services/api';
import {
  reconcileOptimisticStatEntries,
  registerStatEntries,
  subscribeToOptimisticStats,
} from '@/lib/optimisticStats';
import type { StatDefinition, StatEntry, StatEntryStatus } from '@/types/models';
import {
  formatTimeCircleValue,
  formatTimeValue,
  formatDurationValue,
  isTimeAtOrBeforeThreshold,
  timeDisplayScaleMaximum,
  timeDisplayScaleTicks,
  timeValueFromDisplayScale,
  timeValueToScale,
  timeValueToDisplayScale,
} from '@/lib/statValues';
import { AppText } from '../ui/AppText';

const RECENT_DAYS = 5;
const PLOT_HEIGHT = 108;
const PLOT_VERTICAL_INSET = 12;
const PLOT_HORIZONTAL_INSET = 7;
const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DURATION_TICK_STEPS = [15, 30, 60, 120, 180, 240, 360, 480, 720, 960, 1440];
const THRESHOLD_COLOR_TRANSITION = 0.75;
const SLEEP_GREEN_BAND_MINUTES = 60;
const SLEEP_BAD_COLOR_RANGE_MINUTES = 3 * 60;

function isSleepStat(definition: StatDefinition): boolean {
  return definition.systemKey === 'sleep_hours'
    || definition.systemKey === 'sleep_time'
    || definition.systemKey === 'wake_up_time';
}

function sleepGoodDirectionImprovement(definition: StatDefinition, value: number): number {
  return definition.type === 'TIME'
    ? timeValueToScale(definition, definition.goodThreshold!) - timeValueToScale(definition, value)
    : value - definition.goodThreshold!;
}

function sleepColorHue(definition: StatDefinition, value: number): number {
  const improvement = sleepGoodDirectionImprovement(definition, value);
  if (improvement >= -SLEEP_GREEN_BAND_MINUTES) {
    const greenProgress = Math.min(
      1,
      (improvement + SLEEP_GREEN_BAND_MINUTES) / (2 * SLEEP_GREEN_BAND_MINUTES),
    );
    return 90 + greenProgress * 30;
  }

  const redProgress = Math.min(
    1,
    (-improvement - SLEEP_GREEN_BAND_MINUTES) / SLEEP_BAD_COLOR_RANGE_MINUTES,
  );
  return 90 * (1 - redProgress);
}

type NumericDomain = [number, number];
interface ChartPoint { x: number; y: number; value: number; date?: string; }
type DatedChartPoint = ChartPoint & { date: string };

function calendarWeeks(dates: string[]): (string | null)[][] {
  if (dates.length === 0) return [];
  const firstDay = new Date(`${dates[0]}T12:00:00`);
  const leadingEmptyDays = firstDay.getDay();
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

interface BooleanHeatmapBucket {
  from: string;
  to: string;
  average: number | null;
  notPlannedOnly: boolean;
}

function weeklyBooleanAverages(
  dates: string[],
  entriesByDate: Map<string, number>,
  statusesByDate: Map<string, StatEntryStatus>,
): BooleanHeatmapBucket[] {
  const buckets: BooleanHeatmapBucket[] = [];
  for (let index = 0; index < dates.length; index += 7) {
    const bucketDates = dates.slice(index, index + 7);
    const values = bucketDates
      .filter(date => statusesByDate.get(date) !== 'NOT_PLANNED')
      .map(date => entriesByDate.get(date))
      .filter((value): value is number => value !== undefined);
    buckets.push({
      from: bucketDates[0],
      to: bucketDates[bucketDates.length - 1],
      average: values.length > 0
        ? values.reduce((total, value) => total + value, 0) / values.length
        : null,
      notPlannedOnly: values.length === 0
        && bucketDates.some(date => statusesByDate.get(date) === 'NOT_PLANNED'),
    });
  }
  return buckets;
}

function accentHeatmapColor(accent: string, average: number | null, dark: boolean): string {
  if (average == null) return dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
  const hex = Math.round((0.12 + average * 0.88) * 255).toString(16).padStart(2, '0');
  return `${accent}${hex}`;
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

function durationTarget(definition: StatDefinition): number | undefined {
  const target = definition.goodThreshold;
  return target != null
    && Number.isFinite(target)
    && definition.morality !== undefined
    && definition.morality !== 'NEUTRAL'
    ? target
    : undefined;
}

function durationAxis(maximum: number): { maximum: number; ticks: number[] } {
  const desiredStep = maximum / 4;
  const step = DURATION_TICK_STEPS.find(candidate => candidate >= desiredStep)
    ?? Math.ceil(desiredStep / 15) * 15;
  const axisMaximum = Math.max(step, Math.ceil(maximum / step) * step);
  return {
    maximum: axisMaximum,
    ticks: Array.from({ length: axisMaximum / step + 1 }, (_, index) => index * step),
  };
}

function formatDurationAxisValue(value: number): string {
  const rounded = Math.round(value);
  const hours = Math.floor(rounded / 60);
  const minutes = rounded % 60;
  if (hours === 0) return `${minutes}m`;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
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

function thresholdGoodnessRatio(definition: StatDefinition, value: number): number | null {
  if ((definition.type !== 'NUMBER' && definition.type !== 'RANGE' && definition.type !== 'TIME' && definition.type !== 'DURATION')
    || definition.goodThreshold == null
    || !Number.isFinite(definition.goodThreshold)) return null;

  const morality = effectiveMorality(definition);
  if (morality === 'NEUTRAL') return null;

  const threshold = definition.goodThreshold;
  return definition.type === 'TIME'
    ? timeValueToScale(definition, threshold) === 0
      ? timeValueToScale(definition, value) === 0 ? 2 : 0
      : timeValueToScale(definition, threshold) / Math.max(timeValueToScale(definition, value), 1)
    : threshold > 0
    ? morality === 'GOOD' ? value / threshold : value <= 0 ? 3 : threshold / value
    : 1 + (morality === 'GOOD' ? value - threshold : threshold - value) / Math.max(Math.abs(threshold), 1);
}

function thresholdColorProgress(definition: StatDefinition, value: number): number | null {
  const goodnessRatio = thresholdGoodnessRatio(definition, value);
  return goodnessRatio == null
    ? null
    : Math.min(1, Math.abs(goodnessRatio - 1) / THRESHOLD_COLOR_TRANSITION);
}

function thresholdCircleColor(
  definition: StatDefinition,
  value: number,
  successDark: string,
  dangerDark: string,
  thresholdColor: string,
): string | null {
  if (isSleepStat(definition)) return `hsl(${Math.round(sleepColorHue(definition, value))}, 65%, 42%)`;

  const goodnessRatio = thresholdGoodnessRatio(definition, value);
  if (goodnessRatio == null) return null;

  const progressFromThreshold = Math.min(
    1,
    Math.abs(goodnessRatio - 1) / THRESHOLD_COLOR_TRANSITION,
  );
  const directionColor = goodnessRatio >= 1 ? successDark : dangerDark;
  const subduedThresholdColor = mixHexColors(thresholdColor, '#111827', 0.78);
  return mixHexColors(directionColor, subduedThresholdColor, progressFromThreshold);
}

function getCircleTextColor(
  definition: StatDefinition,
  value: number,
  colors: ReturnType<typeof useAppTheme>['colors'],
): string {
  if (isSleepStat(definition)) return sleepColorHue(definition, value) >= 90 ? '#FFFFFF' : '#111827';

  const progress = thresholdColorProgress(definition, value);
  if (progress != null) return progress < 0.72 ? '#111827' : '#FFFFFF';
  return definition.type === 'TIME' || definition.type === 'DURATION'
    ? colors.onAccent
    : colors.text;
}

function getCircleColor(
  definition: StatDefinition,
  value: number | undefined,
  colors: ReturnType<typeof useAppTheme>['colors'],
  dark: boolean,
  status: StatEntryStatus = 'RECORDED',
): string {
  if (value === undefined) return dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
  if (status === 'NOT_PLANNED') return colors.warning;

  // Boolean values use the same semantic colors as the entry controls. In
  // particular, a BAD stat such as cigarettes should make Yes red and No
  // green instead of flowing through the numeric threshold palette.
  if (definition.type === 'BOOLEAN') {
    const morality = effectiveMorality(definition);
    if (morality === 'NEUTRAL') return value === 1 ? colors.accent : colors.secondary;
    if (morality === 'GOOD') return value === 1 ? colors.success : colors.danger;
    return value === 1 ? colors.danger : colors.success;
  }

  const thresholdColor = thresholdCircleColor(
    definition,
    value,
    colors.successDark,
    colors.dangerDark,
    colors.medium,
  );
  if (thresholdColor) return thresholdColor;

  const morality = effectiveMorality(definition);
  const feedback = morality === 'NEUTRAL'
    ? 'NONE'
    : definition.goodThreshold == null
        ? 'NONE'
        : definition.type === 'TIME'
          ? isTimeAtOrBeforeThreshold(definition, value, definition.goodThreshold) ? 'CELEBRATE' : 'SAD'
        : morality === 'GOOD'
          ? value >= definition.goodThreshold ? 'CELEBRATE' : 'NONE'
          : value <= definition.goodThreshold ? 'CELEBRATE' : 'SAD';

  if (feedback === 'CELEBRATE') return colors.success;
  if (feedback === 'SAD') return colors.danger;

  if (morality === 'NEUTRAL') {
    if (definition.type === 'RANGE') {
      const minimum = definition.minValue ?? 0;
      const maximum = definition.maxValue ?? 1;
      const ratio = maximum === minimum ? 0 : Math.max(0, Math.min(1, (value - minimum) / (maximum - minimum)));
      return mixHexColors(colors.secondary, colors.accent, 1 - ratio);
    }
  }

  if (definition.type === 'RANGE') {
    const minimum = definition.minValue ?? 0;
    const maximum = definition.maxValue ?? 1;
    const ratio = maximum === minimum ? 0 : Math.max(0, Math.min(1, (value - minimum) / (maximum - minimum)));
    return `hsl(${Math.round(ratio * 120)}, 65%, 42%)`;
  }
  if (definition.type === 'TIME' || definition.type === 'DURATION') {
    if (morality === 'GOOD') return colors.success;
    if (morality === 'BAD') return colors.danger;
    return colors.accent;
  }
  return dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
}

function formatCircleValue(value: number): string {
  if (Math.abs(value) >= 10000) return `${Math.round(value / 1000)}k`;
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}k`;
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1);
}

function formatStatValue(definition: StatDefinition, value: number): string {
  if (definition.type === 'TIME') return formatTimeCircleValue(definition, value);
  if (definition.type === 'DURATION') return formatDurationValue(value);
  return formatCircleValue(value);
}

const DENSITY_SAMPLE_STEP = 30;
const DENSITY_BANDWIDTH = 50;
const DENSITY_PLOT_HEIGHT = 72;
const DENSITY_VERTICAL_INSET = 6;

function timePosition(definition: StatDefinition, value: number): number {
  return Math.max(0, Math.min(100, (timeValueToDisplayScale(definition, value) / timeDisplayScaleMaximum(definition)) * 100));
}

function timeAxisLabel(definition: StatDefinition, scaleValue: number): string {
  return formatTimeValue(timeValueFromDisplayScale(definition, scaleValue));
}

function gaussianDensity(values: number[], sample: number): number {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => {
    const distance = (sample - value) / DENSITY_BANDWIDTH;
    return total + Math.exp(-0.5 * distance * distance);
  }, 0) / values.length;
}

function timeDensity(definition: StatDefinition, values: number[]): number[] {
  const scaleMaximum = timeDisplayScaleMaximum(definition);
  const scaledValues = values.map(value => timeValueToDisplayScale(definition, value));
  return Array.from(
    { length: scaleMaximum / DENSITY_SAMPLE_STEP + 1 },
    (_, index) => gaussianDensity(scaledValues, index * DENSITY_SAMPLE_STEP),
  );
}

function TimeOfDayHistory({
  definition,
  dates,
  entriesByDate,
  dateRange,
  colors,
}: {
  definition: StatDefinition;
  dates: string[];
  entriesByDate: Map<string, number>;
  dateRange: number;
  colors: ReturnType<typeof useAppTheme>['colors'];
}) {
  const [plotWidth, setPlotWidth] = useState(0);
  const plotHeight = dates.length * 28;
  const scaleMaximum = timeDisplayScaleMaximum(definition);
  const timeTicks = timeDisplayScaleTicks(definition);

  if (dateRange <= 7) {
    const timingPoints = dates.map((date, index) => {
      const value = entriesByDate.get(date);
      if (value === undefined) return undefined;
      return {
        date,
        value,
        x: 7 + (timePosition(definition, value) / 100) * Math.max(0, plotWidth - 14),
        y: index * 28 + 14,
      };
    });
    return (
      <View style={styles.timeHistory} accessibilityLabel={`${definition.name} timing over seven days`}>
        <View style={styles.timeAxisRow}>
          <View style={styles.timeDateLabel} />
          <View style={styles.timeAxis}>
            {timeTicks.map(tick => (
              <AppText key={tick} variant="caption" color="muted" style={styles.timeAxisLabel}>
                {timeAxisLabel(definition, tick)}
              </AppText>
            ))}
          </View>
          <View style={styles.timeValueLabel} />
        </View>
        <View style={styles.timePlotRow}>
          <View style={[styles.timeLabelsColumn, { height: plotHeight }]}>
            {dates.map(date => (
              <View key={date} style={styles.timePlotLabelRow}>
                <AppText variant="caption" color="muted" style={styles.timeDateLabel}>{formatWeekday(date)}</AppText>
              </View>
            ))}
          </View>
          <View
            onLayout={event => setPlotWidth(event.nativeEvent.layout.width)}
            style={[styles.timePlot, { height: plotHeight }]}
          >
            {timeTicks.map(tick => (
              <View key={tick} style={[styles.timeVerticalGrid, { left: `${tick / scaleMaximum * 100}%`, backgroundColor: colors.border }]} />
            ))}
            {dates.slice(1).map((date, index) => (
              <View key={date} style={[styles.timeHorizontalGrid, { top: (index + 1) * 28, backgroundColor: colors.border }]} />
            ))}
            {timingPoints.map(point => point && (
              <View
                key={point.date}
                style={[styles.timeTrendDot, {
                  left: point.x - 4,
                  top: point.y - 4,
                  backgroundColor: colors.accent,
                }]}
              />
            ))}
          </View>
          <View style={[styles.timeLabelsColumn, styles.timeValueColumn, { height: plotHeight }]}>
            {dates.map(date => {
              const value = entriesByDate.get(date);
              return (
                <View key={date} style={styles.timePlotLabelRow} accessible accessibilityLabel={`${date}: ${value === undefined ? 'No entry' : formatTimeValue(value)}`}>
                  <AppText variant="caption" style={[styles.timeValueLabel, { color: value === undefined ? colors.textMuted : colors.text }]}>
                    {value === undefined ? '—' : formatTimeValue(value)}
                  </AppText>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    );
  }

  const values = dates.map(date => entriesByDate.get(date)).filter((value): value is number => value !== undefined);
  const density = timeDensity(definition, values);
  const maximumDensity = Math.max(0.0001, ...density);
  const densityPoints = density.map((sample, index) => ({
    x: density.length === 1
      ? plotWidth / 2
      : DENSITY_VERTICAL_INSET + (index / (density.length - 1)) * Math.max(0, plotWidth - DENSITY_VERTICAL_INSET * 2),
    y: DENSITY_VERTICAL_INSET + (1 - sample / maximumDensity) * (DENSITY_PLOT_HEIGHT - DENSITY_VERTICAL_INSET * 2),
    value: sample,
  }));
  const densitySegments = curvedSegments(densityPoints, DENSITY_PLOT_HEIGHT, DENSITY_VERTICAL_INSET);
  return (
    <View style={styles.timeHistory} accessibilityLabel={`${definition.name} time of day density`}>
      <AppText variant="caption" color="muted" style={styles.densityCount}>
        {values.length} {values.length === 1 ? 'entry' : 'entries'}
      </AppText>
      <View onLayout={event => setPlotWidth(event.nativeEvent.layout.width)} style={[styles.densityPlot, { borderBottomColor: colors.border }]}>
        {densitySegments.map((segment, index) => {
          const width = Math.hypot(segment.end.x - segment.start.x, segment.end.y - segment.start.y);
          const angle = Math.atan2(segment.end.y - segment.start.y, segment.end.x - segment.start.x) * (180 / Math.PI);
          return (
            <View
              key={`${index}-${segment.end.x}`}
              style={[styles.densityLineSegment, {
                width,
                left: (segment.start.x + segment.end.x) / 2 - width / 2,
                top: (segment.start.y + segment.end.y) / 2 - 1,
                backgroundColor: colors.accent,
                transform: [{ rotate: `${angle}deg` }],
              }]}
            />
          );
        })}
      </View>
      <View style={styles.densityLabels}>
        {timeTicks.map(tick => (
          <AppText key={tick} variant="caption" color="muted">{timeAxisLabel(definition, tick)}</AppText>
        ))}
      </View>
    </View>
  );
}

function DurationLineHistory({
  definition,
  entriesByDate,
  buckets,
  dateRange,
  colors,
}: {
  definition: StatDefinition;
  entriesByDate: Map<string, number>;
  buckets: string[][];
  dateRange: number;
  colors: ReturnType<typeof useAppTheme>['colors'];
}) {
  const [plotWidth, setPlotWidth] = useState(0);
  const bars = buckets.map(bucket => {
    const values = bucket.map(date => entriesByDate.get(date)).filter((value): value is number => value !== undefined);
    return {
      date: bucket[0],
      value: values.length > 0 ? values.reduce((total, value) => total + value, 0) / values.length : undefined,
    };
  });
  const recordedValues = bars.map(bar => bar.value).filter((value): value is number => value !== undefined);
  const axis = durationAxis(Math.max(60, durationTarget(definition) ?? 0, ...recordedValues) * 1.08);
  const maximum = axis.maximum;
  const target = durationTarget(definition);
  const gridValues = [...axis.ticks].reverse();
  const isWeekView = dateRange <= 7;
  const trendPoints = bars.map((bar, index) => bar.value === undefined ? undefined : ({
    date: bar.date,
    value: bar.value,
    x: bars.length === 1
      ? plotWidth / 2
      : PLOT_HORIZONTAL_INSET + (index / (bars.length - 1)) * Math.max(0, plotWidth - PLOT_HORIZONTAL_INSET * 2),
    y: PLOT_VERTICAL_INSET + (1 - Math.max(0, Math.min(1, bar.value / maximum))) * (PLOT_HEIGHT - PLOT_VERTICAL_INSET * 2),
  }));
  const recordedTrendPoints = trendPoints.filter((point): point is DatedChartPoint => point !== undefined);
  const trendSegments = curvedSegments(recordedTrendPoints);

  return (
    <View style={styles.durationHistory} accessibilityLabel={`${definition.name} duration trend`}>
      <View style={isWeekView ? styles.durationWeekChart : styles.durationChart}>
        <View style={styles.durationAxis}>
          {gridValues.map(value => <AppText key={value} variant="caption" color="muted" numberOfLines={1}>{formatDurationAxisValue(value)}</AppText>)}
        </View>
        {isWeekView ? (
          <View style={styles.durationBarPlot}>
            <View style={styles.durationBarArea}>
              {axis.ticks.map(value => <View key={value} style={[styles.gridLine, { top: `${100 - value / maximum * 100}%`, backgroundColor: colors.border }]} />)}
              {target !== undefined && <View style={[styles.targetLine, { bottom: `${target / maximum * 100}%`, borderTopColor: colors.success }]} />}
              <View style={styles.durationBars}>
                {bars.map(bar => (
                  <View
                    key={bar.date}
                    style={styles.durationBarColumn}
                    accessible
                    accessibilityLabel={`${bar.date}: ${bar.value === undefined ? 'No entry' : formatDurationValue(bar.value)}`}>
                    {bar.value !== undefined && (
                      <View style={[styles.durationBar, { height: `${Math.max(3, bar.value / maximum * 100)}%`, backgroundColor: colors.accent }]} />
                    )}
                  </View>
                ))}
              </View>
            </View>
            <View style={styles.durationBarLabels}>
              {bars.map(bar => <AppText key={bar.date} variant="caption" color="muted" style={styles.durationBarLabel}>{formatWeekday(bar.date)}</AppText>)}
            </View>
          </View>
        ) : (
          <View onLayout={event => setPlotWidth(event.nativeEvent.layout.width)} style={styles.durationPlot}>
            {axis.ticks.map(value => <View key={value} style={[styles.gridLine, { top: `${100 - value / maximum * 100}%`, backgroundColor: colors.border }]} />)}
            {target !== undefined && <View style={[styles.targetLine, { bottom: `${target / maximum * 100}%`, borderTopColor: colors.success }]} />}
            {trendSegments.map((segment, index) => {
              const width = Math.hypot(segment.end.x - segment.start.x, segment.end.y - segment.start.y);
              const angle = Math.atan2(segment.end.y - segment.start.y, segment.end.x - segment.start.x) * (180 / Math.PI);
              return (
                <View
                  key={`${index}-${segment.end.x}`}
                  style={[styles.durationTrendSegment, {
                    width,
                    left: (segment.start.x + segment.end.x) / 2 - width / 2,
                    top: (segment.start.y + segment.end.y) / 2 - 1,
                    backgroundColor: colors.accent,
                    transform: [{ rotate: `${angle}deg` }],
                  }]}
                />
              );
            })}
            {recordedTrendPoints.map((point, index) => (
              <View
                key={`${index}-${point.x}-point`}
                accessible
                accessibilityLabel={`${point.date}: ${formatDurationValue(point.value)}`}
                style={[styles.durationTrendPoint, { left: point.x - 3, top: point.y - 3, backgroundColor: colors.accent }]}
              />
            ))}
          </View>
        )}
      </View>
      <View style={styles.durationRangeLabels}>
        <AppText variant="caption" color="muted">{formatShortDate(bars[0].date)}</AppText>
        <AppText variant="caption" color="muted">{formatShortDate(bars[bars.length - 1].date)}</AppText>
      </View>
      {recordedValues.length === 0 && <AppText variant="caption" color="muted">No history yet</AppText>}
    </View>
  );
}

function RecentValueDots({
  definition,
  dates,
  entriesByDate,
  statusesByDate,
  colors,
  dark,
}: {
  definition: StatDefinition;
  dates: string[];
  entriesByDate: Map<string, number>;
  statusesByDate: Map<string, StatEntryStatus>;
  colors: ReturnType<typeof useAppTheme>['colors'];
  dark: boolean;
}) {
  return (
    <View style={styles.recentDots}>
      {dates.map(date => {
        const value = entriesByDate.get(date);
        const status = statusesByDate.get(date) ?? 'RECORDED';
        const label = value === undefined ? '—' : formatStatValue(definition, value);
        const isUnboundedNumber = definition.type === 'NUMBER';
        const hasVisibleValue = definition.type === 'NUMBER'
          || definition.type === 'TIME'
          || definition.type === 'DURATION';
        return (
          <View
            key={date}
            accessible
            accessibilityLabel={`${date}: ${value === undefined ? 'No entry' : label}`}
            style={[
              styles.dot,
              { backgroundColor: getCircleColor(definition, value, colors, dark, status) },
              isUnboundedNumber && value === undefined && { borderColor: colors.border, borderStyle: 'dashed', borderWidth: 1 },
            ]}>
            {hasVisibleValue && value !== undefined && (
              <AppText
                variant="caption"
                style={[styles.dotValue, { fontSize: label.length > 5 ? 6 : label.length > 3 ? 7 : 9, color: getCircleTextColor(definition, value, colors) }]}
              >
                {label}
              </AppText>
            )}
          </View>
        );
      })}
    </View>
  );
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
  if (minimum >= 0) {
    if (maximum === 0) return [0, 1];
    const paddedMaximum = maximum * 1.1;
    const step = niceTickStep(paddedMaximum);
    const nextNiceTick = Math.ceil(maximum / step) * step;
    return [0, Math.max(paddedMaximum, nextNiceTick + step * 0.1)];
  }
  if (maximum <= 0) {
    const paddedMinimum = minimum * 1.1;
    const step = niceTickStep(Math.abs(paddedMinimum));
    const nextNiceTick = Math.floor(minimum / step) * step;
    return [Math.min(paddedMinimum, nextNiceTick - step * 0.1), 0];
  }
  return paddedDomain(minimum, maximum);
}

function paddedDomain(minimum: number, maximum: number): NumericDomain {
  const span = maximum - minimum;
  const padding = span === 0 ? Math.max(Math.abs(maximum) * 0.1, 1) : span * 0.1;
  return [minimum - padding, maximum + padding];
}

function niceTickStep(range: number, targetTickCount = 5): number {
  if (range <= 0 || !Number.isFinite(range)) return 1;
  const rawStep = range / targetTickCount;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalizedStep = rawStep / magnitude;
  const multiplier = normalizedStep < Math.sqrt(2)
    ? 1
    : normalizedStep < Math.sqrt(10)
      ? 2
      : normalizedStep < Math.sqrt(50)
        ? 5
        : 10;
  return multiplier * magnitude;
}

function roundTick(value: number, step: number): number {
  const decimalPlaces = Math.max(0, Math.ceil(-Math.log10(step)) + 2);
  return Number(value.toFixed(decimalPlaces));
}

function axisTicks(definition: StatDefinition, domain: NumericDomain): number[] {
  if (definition.type === 'BOOLEAN') return [0, 1];
  const [minimum, maximum] = domain;
  const step = niceTickStep(maximum - minimum);
  const firstIndex = Math.ceil(minimum / step - 1e-9);
  const lastIndex = Math.floor(maximum / step + 1e-9);
  const ticks = Array.from(
    { length: Math.max(0, lastIndex - firstIndex + 1) },
    (_, index) => roundTick((firstIndex + index) * step, step),
  );
  return [...new Set(ticks)].sort((left, right) => left - right);
}

function formatChartValue(value: number): string {
  return Number.isInteger(value) ? String(value) : Number(value.toFixed(2)).toString();
}

function formatAxisValue(value: number, definition: StatDefinition): string {
  return definition.type === 'DURATION' ? formatDurationValue(value) : formatChartValue(value);
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

function curvedSegments(
  points: ChartPoint[],
  plotHeight = PLOT_HEIGHT,
  verticalInset = PLOT_VERTICAL_INSET,
): ChartSegment[] {
  const segments: ChartSegment[] = [];
  const sampleCount = 8;

  points.slice(1).forEach((end, index) => {
    const start = points[index];
    const previous = points[index - 1] ?? start;
    const next = points[index + 2] ?? end;
    const clampY = (value: number) => Math.max(verticalInset, Math.min(plotHeight - verticalInset, value));
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
          registerStatEntries(nextEntries, definition.id, dates[0], dates[dates.length - 1]);
          setEntries(reconcileOptimisticStatEntries(nextEntries, dates[0], dates[dates.length - 1], definition.id));
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

  useEffect(() => subscribeToOptimisticStats(() => {
    setEntries(current => reconcileOptimisticStatEntries(current, dates[0], dates[dates.length - 1], definition.id));
  }), [dates, definition.id]);

  const visibleEntries = useMemo(() => reconcileOptimisticStatEntries(
    todayEntry ? [...entries.filter(entry => entry.date !== todayEntry.date), todayEntry] : entries,
    dates[0],
    dates[dates.length - 1],
    definition.id,
  ), [dates, definition.id, entries, todayEntry]);
  const entriesByDate = useMemo(() => {
    const map = new Map(visibleEntries.map(entry => [entry.date, entry.value]));
    return map;
  }, [visibleEntries]);
  const statusesByDate = useMemo(() => {
    const map = new Map(visibleEntries.map(entry => [entry.date, entry.status ?? 'RECORDED'] as [string, StatEntryStatus]));
    return map;
  }, [visibleEntries]);
  const recentDates = dates.slice(-RECENT_DAYS);
  const buckets = useMemo(() => chartBuckets(dates, dateRange), [dates, dateRange]);
  const recordedValues = Array.from(entriesByDate.values());
  const hasHistory = recordedValues.length > 0;
  const domain = chartDomain(definition, recordedValues);
  const domainMinimum = domain[0];
  const domainMaximum = domain[1];
  const chartTicks = axisTicks(definition, domain);
  const chartSpan = domainMaximum - domainMinimum || 1;
  const [plotWidth, setPlotWidth] = useState(0);
  const chartPoints = useMemo(() => {
    return buckets
      .map((bucket, index) => {
        const values = bucket
          .filter(date => !(definition.type === 'BOOLEAN' && statusesByDate.get(date) === 'NOT_PLANNED'))
          .map(date => entriesByDate.get(date) ?? (definition.type === 'BOOLEAN' ? 0 : undefined))
          .filter((value): value is number => value !== undefined);
        const value = values.length > 0 ? values.reduce((total, item) => total + item, 0) / values.length : undefined;
        if (value === undefined || !hasHistory) return undefined;
        const ratio = Math.max(0, Math.min(1, (value - domainMinimum) / chartSpan));
        return {
          x: buckets.length === 1
            ? plotWidth / 2
            : PLOT_HORIZONTAL_INSET + (index / (buckets.length - 1)) * Math.max(0, plotWidth - PLOT_HORIZONTAL_INSET * 2),
          y: PLOT_VERTICAL_INSET + (1 - ratio) * (PLOT_HEIGHT - PLOT_VERTICAL_INSET * 2),
          value,
        };
      })
      .filter((point): point is ChartPoint => point !== undefined);
  }, [buckets, chartSpan, definition.type, domainMinimum, entriesByDate, hasHistory, plotWidth, statusesByDate]);
  const chartSegments = useMemo(() => curvedSegments(chartPoints), [chartPoints]);
  const calendar = useMemo(() => calendarWeeks(dates), [dates]);

  if (definition.type === 'TIME') {
    return (
      <View style={styles.history}>
        <View style={styles.compactHeader}>
          {header && <View style={styles.headerSlot}>{header}</View>}
          <RecentValueDots definition={definition} dates={recentDates} entriesByDate={entriesByDate} statusesByDate={statusesByDate} colors={colors} dark={dark} />
          {loading && <ActivityIndicator size="small" color={colors.accent} />}
        </View>
        <TimeOfDayHistory
          definition={definition}
          dates={dates}
          entriesByDate={entriesByDate}
          dateRange={dateRange}
          colors={colors}
        />
        {error && <AppText variant="caption" color="danger">History unavailable</AppText>}
        {!error && dateRange > 7 && <AppText variant="caption" color="muted">{formatShortDate(dates[0])} – {formatShortDate(dates[dates.length - 1])}</AppText>}
      </View>
    );
  }

  if (definition.type === 'DURATION') {
    return (
      <View style={styles.history}>
        <View style={styles.compactHeader}>
          {header && <View style={styles.headerSlot}>{header}</View>}
          <RecentValueDots definition={definition} dates={recentDates} entriesByDate={entriesByDate} statusesByDate={statusesByDate} colors={colors} dark={dark} />
          {loading && <ActivityIndicator size="small" color={colors.accent} />}
        </View>
        <DurationLineHistory
          definition={definition}
          entriesByDate={entriesByDate}
          buckets={buckets}
          dateRange={dateRange}
          colors={colors}
        />
        {error && <AppText variant="caption" color="danger">History unavailable</AppText>}
      </View>
    );
  }

  if (definition.type === 'BOOLEAN') {
    const yesColor = getCircleColor(definition, 1, colors, dark);
    const noColor = getCircleColor(definition, 0, colors, dark);
    const isHeatmap = dateRange > 30;
    const heatmapBuckets = isHeatmap ? weeklyBooleanAverages(dates, entriesByDate, statusesByDate) : [];
    const notPlannedColor = colors.warning;

    return (
      <View style={styles.history}>
        <View style={styles.compactHeader}>
          {header && <View style={styles.headerSlot}>{header}</View>}
          {loading && <ActivityIndicator size="small" color={colors.accent} />}
        </View>
        {isHeatmap ? (
          <View
            style={[styles.heatmapStrip, { height: dateRange <= 90 ? 32 : 24 }]}
            accessibilityLabel={`${definition.name} weekly heatmap; darker means more yes entries`}
            onStartShouldSetResponder={() => true}
          >
            {heatmapBuckets.map((bucket, index) => (
              <View
                key={`${bucket.from}-${index}`}
                accessible
                accessibilityLabel={`${bucket.from} – ${bucket.to}: ${bucket.notPlannedOnly ? 'Not planned' : bucket.average == null ? 'No entries' : `${Math.round(bucket.average * 100)}% yes`}`}
                style={[styles.heatmapBucket, { backgroundColor: bucket.notPlannedOnly ? `${notPlannedColor}99` : accentHeatmapColor(colors.accent, bucket.average, dark) }]}
              />
            ))}
          </View>
        ) : (
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
                    const status = date ? statusesByDate.get(date) ?? 'RECORDED' : 'RECORDED';
                    return (
                      <View
                        key={date ?? `empty-${weekIndex}-${dayIndex}`}
                        accessible={Boolean(date)}
                        accessibilityLabel={date ? `${date}: ${value === undefined ? 'Not recorded' : status === 'NOT_PLANNED' ? 'Not planned' : value === 1 ? 'Yes' : 'No'}` : undefined}
                        style={[
                          styles.calendarCell,
                          { height: 27 },
                          date && value === undefined && { backgroundColor: `${colors.border}35` },
                          date && value === 1 && { backgroundColor: yesColor },
                          date && value === 0 && { backgroundColor: noColor },
                          date && status === 'NOT_PLANNED' && { backgroundColor: notPlannedColor },
                        ]}
                      />
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        )}
        <View style={styles.calendarFooter}>
          {isHeatmap ? (
            <View style={styles.calendarLegend}>
              <View style={[styles.legendSwatch, { backgroundColor: accentHeatmapColor(colors.accent, 0, dark) }]} />
              <AppText variant="caption" color="muted">Less often</AppText>
              <View style={[styles.legendSwatch, { backgroundColor: colors.accent }]} />
              <AppText variant="caption" color="muted">More often</AppText>
            </View>
          ) : (
            <View style={styles.calendarLegend}>
              <View style={[styles.legendSwatch, { backgroundColor: yesColor }]} />
              <AppText variant="caption" color="muted">Yes</AppText>
              <View style={[styles.legendSwatch, { backgroundColor: noColor }]} />
              <AppText variant="caption" color="muted">No</AppText>
              <View style={[styles.legendSwatch, { backgroundColor: notPlannedColor }]} />
              <AppText variant="caption" color="muted">Not planned</AppText>
            </View>
          )}
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
        <RecentValueDots definition={definition} dates={recentDates} entriesByDate={entriesByDate} statusesByDate={statusesByDate} colors={colors} dark={dark} />
        {loading && <ActivityIndicator size="small" color={colors.accent} />}
      </View>

      <View style={[styles.chart, !hasHistory && styles.chartEmpty]}>
        <View style={styles.chartAxis}>
          {[...chartTicks].reverse().map(value => (
            <AppText key={value} variant="caption" color="muted" numberOfLines={1}>
              {formatAxisValue(value, definition)}
            </AppText>
          ))}
        </View>
        <View onLayout={event => setPlotWidth(event.nativeEvent.layout.width)} style={styles.plot}>
          {chartTicks.map(value => {
            const position = 100 - ((value - domainMinimum) / chartSpan) * 100;
            return <View key={value} style={[styles.gridLine, { top: `${position}%`, backgroundColor: colors.border }]} />;
          })}
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
  recentDots: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dotValue: { fontSize: 9, lineHeight: 10, fontWeight: '700' },
  timeHistory: { gap: 7 },
  timeAxisRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  timeDateLabel: { width: 45, fontSize: 10, lineHeight: 13 },
  timeAxis: { flex: 1, flexDirection: 'row', justifyContent: 'space-between' },
  timeAxisLabel: { fontSize: 8, lineHeight: 11 },
  timeValueLabel: { width: 48, textAlign: 'right', fontSize: 10, lineHeight: 13, fontWeight: '700' },
  timePlotRow: { flexDirection: 'row', alignItems: 'stretch', gap: 8 },
  timeLabelsColumn: { width: 45 },
  timeValueColumn: { width: 48 },
  timePlotLabelRow: { height: 28, justifyContent: 'center' },
  timePlot: { flex: 1, position: 'relative', overflow: 'hidden', borderRadius: 8 },
  timeVerticalGrid: { position: 'absolute', top: 0, bottom: 0, width: 1, opacity: 0.7 },
  timeHorizontalGrid: { position: 'absolute', left: 0, right: 0, height: 1, opacity: 0.55 },
  timeTrendDot: { position: 'absolute', width: 8, height: 8, borderRadius: 4 },
  densityCount: { alignSelf: 'flex-end' },
  densityPlot: { height: DENSITY_PLOT_HEIGHT, overflow: 'hidden', position: 'relative', borderBottomWidth: 1, borderTopLeftRadius: 8, borderTopRightRadius: 8 },
  densityLineSegment: { height: 2, position: 'absolute', borderRadius: 1 },
  densityLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  durationHistory: { gap: 5 },
  durationChart: { flexDirection: 'row', height: PLOT_HEIGHT, gap: 8 },
  durationWeekChart: { flexDirection: 'row', height: PLOT_HEIGHT + 18, gap: 8 },
  durationAxis: { width: 52, justifyContent: 'space-between', alignItems: 'flex-end', paddingVertical: 3 },
  durationPlot: { flex: 1, position: 'relative', overflow: 'hidden', borderRadius: 8 },
  durationBarPlot: { flex: 1, position: 'relative', height: PLOT_HEIGHT + 18 },
  durationBarArea: { position: 'absolute', top: 0, left: 0, right: 0, height: PLOT_HEIGHT, overflow: 'hidden', borderRadius: 8 },
  durationBars: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, flexDirection: 'row', alignItems: 'flex-end', gap: 3, paddingHorizontal: 2 },
  durationBarColumn: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  durationBar: { width: '32%', minHeight: 3, borderRadius: 5 },
  durationBarLabels: { position: 'absolute', left: 0, right: 0, top: PLOT_HEIGHT + 2, flexDirection: 'row', gap: 3, paddingHorizontal: 2 },
  durationBarLabel: { flex: 1, textAlign: 'center', fontSize: 9 },
  durationTrendSegment: { position: 'absolute', height: 2, borderRadius: 1 },
  durationTrendPoint: { position: 'absolute', width: 6, height: 6, borderRadius: 3 },
  durationRangeLabels: { flexDirection: 'row', justifyContent: 'space-between', marginLeft: 60 },
  booleanCalendar: { gap: 4 },
  calendarGrid: { gap: 4 },
  calendarWeek: { flexDirection: 'row', gap: 4 },
  calendarWeekday: { flex: 1, textAlign: 'center', fontSize: 10, lineHeight: 13 },
  calendarCell: { flex: 1, borderRadius: 5 },
  heatmapStrip: { width: '100%', flexDirection: 'row', overflow: 'hidden', borderRadius: 8 },
  heatmapBucket: { flex: 1, height: '100%' },
  calendarFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  calendarLegend: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendSwatch: { width: 8, height: 8, borderRadius: 3, marginLeft: 4 },
  chart: { flexDirection: 'row', height: PLOT_HEIGHT, gap: 8 },
  chartEmpty: { opacity: 0.55 },
  chartAxis: { width: 46, justifyContent: 'space-between', alignItems: 'flex-end', paddingVertical: 3 },
  plot: { flex: 1, height: PLOT_HEIGHT, overflow: 'hidden', position: 'relative', borderRadius: 8 },
  gridLine: { position: 'absolute', left: 0, right: 0, height: 1 },
  targetLine: { position: 'absolute', left: 0, right: 0, borderTopWidth: 2, borderStyle: 'dashed', opacity: 0.75 },
  segment: { height: 2, position: 'absolute', borderRadius: 1 },
  plotPoint: { position: 'absolute', width: 6, height: 6, borderRadius: 3 },
  dateLabels: { flexDirection: 'row', justifyContent: 'space-between' },
});
