import { Image, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { type BoundaryStatusRow, formatMinutes } from '@/lib/boundaryStatus';
import { useAppTheme } from '@/providers/ThemeProvider';
import type { InstalledApp } from '@/services/boundaries';

/** Where every limited app stands today: time left, the open running now and opens used. */
export function BoundaryStatusCard({ rows, apps }: { rows: BoundaryStatusRow[]; apps: Map<string, InstalledApp> }) {
  if (!rows.length) return null;
  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <AppText variant="heading">Today</AppText>
        <AppText variant="caption" color="muted">Time left today, the open running now and opens used, for every app with a limit.</AppText>
      </View>
      {rows.map(row => <StatusRow key={row.pkg} row={row} app={apps.get(row.pkg)} />)}
    </Card>
  );
}

function StatusRow({ row, app }: { row: BoundaryStatusRow; app: InstalledApp | undefined }) {
  const { colors } = useAppTheme();
  const name = app?.appName ?? row.pkg;
  return (
    <View accessibilityLabel={name} style={[styles.row, { borderTopColor: colors.border }]}>
      {app?.icon
        ? <Image source={{ uri: `data:image/png;base64,${app.icon}` }} style={styles.icon} />
        : <View style={[styles.icon, { backgroundColor: colors.surfaceRaised }]} />}
      <View style={styles.copy}>
        <AppText variant="label" numberOfLines={1}>{name}</AppText>
        {row.daily ? (
          <>
            <AppText variant="caption" color="muted">
              {row.daily.leftMs > 0
                ? `${formatMinutes(row.daily.leftMs)} left of ${formatMinutes(row.daily.limitMs)} today`
                : 'Done for today'}
            </AppText>
            <View
              accessibilityRole="progressbar"
              accessibilityLabel={`${name} daily time used`}
              accessibilityValue={{ min: 0, max: row.daily.limitMs, now: Math.min(row.daily.usedMs, row.daily.limitMs) }}
              style={[styles.track, { backgroundColor: colors.border }]}>
              <View style={[styles.fill, { backgroundColor: colors.accent, width: `${Math.min(100, (row.daily.usedMs / row.daily.limitMs) * 100)}%` }]} />
            </View>
          </>
        ) : (
          <AppText variant="caption" color="muted">No daily limit</AppText>
        )}
        {row.session ? (
          <AppText variant="caption" color={row.live ? 'accent' : 'muted'} style={row.live && styles.live}>{row.session}</AppText>
        ) : null}
        <AppText variant="caption" color="muted">{row.opensLabel}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  header: { gap: 4 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  icon: { width: 36, height: 36, borderRadius: 10 },
  copy: { flex: 1, gap: 3 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden', marginVertical: 2 },
  fill: { height: 6, borderRadius: 3 },
  live: { fontWeight: '600' },
});
