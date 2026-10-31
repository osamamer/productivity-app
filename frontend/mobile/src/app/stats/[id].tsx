import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { StatHistoryPreview, type StatHistoryPoint } from '@/components/stats/StatHistoryPreview';
import { StatEntrySheet } from '@/components/stats/StatEntrySheet';
import { Card } from '@/components/ui/Card';
import { AppText } from '@/components/ui/AppText';
import { LoadingView, ErrorView } from '@/components/ui/StateView';
import { SilentPressable } from '@/components/ui/SilentPressable';
import { formatShortDate, localDate } from '@/lib/date';
import { formatDurationValue, formatTimeValue } from '@/lib/statValues';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useAppTheme } from '@/providers/ThemeProvider';
import { api } from '@/services/api';
import type { StatDefinition, StatEntry } from '@/types/models';

interface StatDetailData {
  definition: StatDefinition;
  todayEntry?: StatEntry;
}

type DateRangeKey = '7-days' | '30-days' | '3-months' | '1-year' | 'this-month' | 'this-year';

interface DateRange {
  value: DateRangeKey;
  label: string;
}

const DATE_RANGES: DateRange[] = [
  { value: '7-days', label: '7 days' },
  { value: '30-days', label: '30 days' },
  { value: '3-months', label: '3 months' },
  { value: '1-year', label: '1 year' },
  { value: 'this-month', label: 'This month' },
  { value: 'this-year', label: 'This year' },
];

function rangeDates(period: DateRangeKey): { from: string; to: string; days: number } {
  const to = new Date();
  const from = new Date(to);
  const rollingDays = period === '7-days' ? 7
    : period === '30-days' ? 30
      : period === '3-months' ? 90
        : period === '1-year' ? 365
          : undefined;
  if (rollingDays) {
    from.setDate(from.getDate() - rollingDays + 1);
  } else if (period === 'this-month') {
    from.setDate(1);
  } else {
    from.setMonth(0, 1);
  }

  const fromDate = localDate(from);
  const toDate = localDate(to);
  const fromUtc = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const toUtc = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return { from: fromDate, to: toDate, days: Math.round((toUtc - fromUtc) / 86_400_000) + 1 };
}

function formatRangeDate(value: string, includeYear: boolean): string {
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    ...(includeYear ? { year: 'numeric' as const } : {}),
  }).format(date);
}

function formatLogDate(value: string): string {
  const date = new Date(`${value}T12:00:00`);
  const day = date.getDate();
  const suffix = day % 100 >= 11 && day % 100 <= 13
    ? 'th'
    : day % 10 === 1
      ? 'st'
      : day % 10 === 2
        ? 'nd'
        : day % 10 === 3
          ? 'rd'
          : 'th';
  const month = new Intl.DateTimeFormat(undefined, { month: 'short' }).format(date);
  return `${month} ${day}${suffix}`;
}

function formatPointValue(definition: StatDefinition, point: StatHistoryPoint): string {
  if (point.status === 'NOT_PLANNED') return 'Not planned';
  if (point.value === undefined) return 'No entry';
  if (definition.type === 'BOOLEAN') {
    if (point.from !== point.to) return `${Math.round(point.value * 100)}% yes`;
    return point.value === 1 ? 'Yes' : 'No';
  }
  if (definition.type === 'TIME') return formatTimeValue(point.value);
  if (definition.type === 'DURATION') return formatDurationValue(point.value);
  return Number.isInteger(point.value) ? String(point.value) : String(Number(point.value.toFixed(2)));
}

export default function StatDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const statId = Array.isArray(id) ? id[0] : id;
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const resource = useAsyncData<StatDetailData>(async () => {
    const [definitions, todayEntries] = await Promise.all([api.stats.definitions(), api.stats.today()]);
    const definition = definitions.find(item => item.id === statId);
    if (!definition) throw new Error('Stat no longer exists.');
    return {
      definition,
      todayEntry: todayEntries.find(entry => entry.statDefinitionId === definition.id),
    };
  });
  const [dateRange, setDateRange] = useState<DateRangeKey>('30-days');
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [entries, setEntries] = useState<StatEntry[]>([]);
  const [entryDate, setEntryDate] = useState<string | undefined>();
  const [selectedPoint, setSelectedPoint] = useState<StatHistoryPoint | null>(null);
  const [periodMenuOpen, setPeriodMenuOpen] = useState(false);
  const definition = resource.data?.definition;
  const datePeriod = useMemo(() => rangeDates(dateRange), [dateRange]);
  const calendarHeatmap = dateRange === '3-months' || dateRange === '1-year' || dateRange === 'this-year';
  const includeRangeYear = dateRange === '1-year'
    || dateRange === 'this-year'
    || datePeriod.from.slice(0, 4) !== datePeriod.to.slice(0, 4);
  const dateRangeLabel = `${formatRangeDate(datePeriod.from, includeRangeYear)} – ${formatRangeDate(datePeriod.to, includeRangeYear)}`;
  const sortedEntries = useMemo(() => [...entries].sort((first, second) => second.date.localeCompare(first.date)), [entries]);

  const receiveEntries = useCallback((nextEntries: StatEntry[]) => {
    setEntries(nextEntries);
  }, []);

  function openEntry(date?: string) {
    setEntryDate(date ?? localDate());
  }

  function handleEntrySaved(entry: StatEntry | null, date?: string) {
    const changedDate = date ?? entry?.date;
    if (changedDate) {
      setEntries(current => [
        ...current.filter(existing => existing.date !== changedDate),
        ...(entry ? [entry] : []),
      ]);
      setSelectedPoint(current => current?.from === changedDate && current.to === changedDate
        ? {
          from: changedDate,
          to: changedDate,
          value: entry?.value,
          sampleCount: entry?.value == null || entry.status === 'NOT_PLANNED' ? 0 : 1,
          status: entry?.status === 'NOT_PLANNED' ? 'NOT_PLANNED' : undefined,
        }
        : current);
    }
    if (changedDate === localDate() && resource.data) {
      resource.setData({ ...resource.data, todayEntry: entry ?? undefined });
    }
    setHistoryRefreshKey(key => key + 1);
  }

  if (resource.loading && !resource.data) {
    return <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}><LoadingView label="Loading stat details…" /></SafeAreaView>;
  }

  if (resource.error && !resource.data) {
    return <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}><ErrorView message={resource.error} retry={() => void resource.reload()} /></SafeAreaView>;
  }

  if (!definition) return null;

  const selectedPointDate = selectedPoint
    ? selectedPoint.from === selectedPoint.to
      ? formatShortDate(selectedPoint.from)
      : `${formatShortDate(selectedPoint.from)} – ${formatShortDate(selectedPoint.to)}`
    : undefined;
  const selectedPointValue = selectedPoint ? formatPointValue(definition, selectedPoint) : undefined;
  const activePeriodLabel = DATE_RANGES.find(period => period.value === dateRange)?.label ?? '30 days';
  const selectedLogDate = selectedPoint && selectedPoint.from === selectedPoint.to ? selectedPoint.from : undefined;
  const logButtonLabel = selectedLogDate ? `Log ${formatLogDate(selectedLogDate)}` : 'Log';
  const detailPlotHeight = Math.max(90, Math.min(500, height - insets.top - insets.bottom - 211));

  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={styles.chartArea}>
        <View style={styles.chartHeader}>
          <SilentPressable
            accessibilityRole="button"
            accessibilityLabel="Back to statistics"
            hitSlop={10}
            onPress={() => router.canGoBack() ? router.back() : router.replace('/stats')}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </SilentPressable>
          <View style={styles.chartTitleGroup}>
            <AppText variant="heading" numberOfLines={1} style={styles.chartTitle}>{definition.name}</AppText>
            <AppText variant="caption" color="muted" numberOfLines={1}>{dateRangeLabel}</AppText>
          </View>
        </View>
        <Card style={styles.chartCard}>
          <StatHistoryPreview
            definition={definition}
            todayEntry={resource.data?.todayEntry}
            dateRange={datePeriod.days}
            dateFrom={datePeriod.from}
            dateTo={datePeriod.to}
            calendarHeatmap={calendarHeatmap}
            refreshKey={historyRefreshKey}
            detailMode
            detailHeight={detailPlotHeight}
            onEntriesLoaded={receiveEntries}
            onPointSelected={setSelectedPoint}
          />
        </Card>
      </View>

      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        {periodMenuOpen && (
          <>
            <SilentPressable
              accessibilityRole="button"
              accessibilityLabel="Close period options"
              style={styles.menuDismiss}
              onPress={() => setPeriodMenuOpen(false)}
            />
            <View style={[styles.periodMenu, { backgroundColor: colors.surface, borderColor: colors.border, bottom: 74 }]}>
              {DATE_RANGES.map(period => (
                <SilentPressable
                  key={period.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: dateRange === period.value }}
                  onPress={() => { setDateRange(period.value); setSelectedPoint(null); setPeriodMenuOpen(false); }}
                  style={({ pressed }) => [styles.periodOption, dateRange === period.value && { backgroundColor: colors.accentSoft }, pressed && styles.pressed]}
                >
                  <AppText variant="label" style={styles.grow}>{period.label}</AppText>
                  {dateRange === period.value && <Ionicons name="checkmark" size={18} color={colors.accent} />}
                </SilentPressable>
              ))}
            </View>
          </>
        )}
        <View style={[styles.stickyControls, styles.stickyControlBottom]}>
          {selectedPoint && (
            <View style={styles.selectedPointReadout}>
              <View style={styles.pointSummaryCopy}>
                <AppText variant="caption" color="muted" numberOfLines={1}>
                  {selectedPoint.from !== selectedPoint.to
                    ? `Average across ${selectedPoint.sampleCount} ${selectedPoint.sampleCount === 1 ? 'day' : 'days'} · ${selectedPointDate}`
                    : selectedPointDate}
                </AppText>
                <AppText variant="label" numberOfLines={1}>{selectedPointValue}</AppText>
              </View>
            </View>
          )}
          <SilentPressable
            accessibilityRole="button"
            accessibilityLabel={`Choose period, currently ${activePeriodLabel}`}
            accessibilityState={{ expanded: periodMenuOpen }}
            onPress={() => setPeriodMenuOpen(open => !open)}
            style={({ pressed }) => [styles.stickyButton, { backgroundColor: colors.surface, borderColor: colors.accent, shadowColor: colors.text }, pressed && styles.pressed]}
          >
            <Ionicons name="calendar-outline" size={18} color={colors.accent} />
            <AppText variant="label" color="accent">{activePeriodLabel}</AppText>
          </SilentPressable>
          <SilentPressable
            accessibilityRole="button"
            accessibilityLabel={selectedLogDate ? `Log stat for ${formatLogDate(selectedLogDate)}` : 'Log stat'}
            onPress={() => openEntry(selectedLogDate)}
            style={({ pressed }) => [styles.stickyButton, { backgroundColor: colors.surface, borderColor: colors.accent, shadowColor: colors.text }, pressed && styles.pressed]}
          >
            <Ionicons name="add" size={19} color={colors.accent} />
            <AppText variant="label" color="accent">{logButtonLabel}</AppText>
          </SilentPressable>
        </View>
      </View>

      <StatEntrySheet
        key={`${definition.id}-${entryDate ?? 'closed'}`}
        definition={entryDate ? definition : null}
        existing={entryDate ? sortedEntries.find(entry => entry.date === entryDate) : undefined}
        initialDate={entryDate}
        onClose={() => setEntryDate(undefined)}
        onSaved={handleEntrySaved}
        onReverted={(entry, date) => {
          const revertedDate = date ?? entry?.date;
          if (revertedDate) {
            setEntries(current => [
              ...current.filter(existing => existing.date !== revertedDate),
              ...(entry ? [entry] : []),
            ]);
            setSelectedPoint(current => current?.from === revertedDate && current.to === revertedDate
              ? {
                from: revertedDate,
                to: revertedDate,
                value: entry?.value,
                sampleCount: entry?.value == null || entry.status === 'NOT_PLANNED' ? 0 : 1,
                status: entry?.status === 'NOT_PLANNED' ? 'NOT_PLANNED' : undefined,
              }
              : current);
          }
          if (revertedDate === localDate() && resource.data) {
            resource.setData({ ...resource.data, todayEntry: entry });
          }
          setHistoryRefreshKey(key => key + 1);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  chartArea: { flex: 1, minHeight: 0, justifyContent: 'flex-start', paddingHorizontal: 8, paddingTop: 4, paddingBottom: 70 },
  chartHeader: { minHeight: 50, flexShrink: 0, position: 'relative', paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  backButton: { position: 'absolute', left: 0, top: 1, width: 36, height: 28, alignItems: 'flex-start', justifyContent: 'center', zIndex: 1 },
  chartTitleGroup: { alignItems: 'center', justifyContent: 'center', gap: 2, width: '100%', paddingHorizontal: 36 },
  chartTitle: { width: '100%', textAlign: 'center', fontSize: 21, lineHeight: 26 },
  chartCard: { flex: 1, minHeight: 0, padding: 12, justifyContent: 'center' },
  stickyControls: { position: 'absolute', left: 18, right: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  stickyControlBottom: { bottom: 12 },
  stickyButton: { minHeight: 48, borderRadius: 24, paddingHorizontal: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, shadowOffset: { width: 0, height: 5 }, shadowRadius: 12, shadowOpacity: 0.22, elevation: 6 },
  selectedPointReadout: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: 'auto' },
  pointSummaryCopy: { flex: 1, minWidth: 0, gap: 1 },
  menuDismiss: { ...StyleSheet.absoluteFill },
  periodMenu: { position: 'absolute', right: 18, width: 180, borderWidth: 1, borderRadius: 16, padding: 8, gap: 3, shadowColor: '#11111A', shadowOffset: { width: 0, height: 5 }, shadowRadius: 16, shadowOpacity: 0.22, elevation: 8 },
  periodOption: { minHeight: 42, borderRadius: 10, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  grow: { flex: 1 },
  pressed: { opacity: 0.68 },
});
