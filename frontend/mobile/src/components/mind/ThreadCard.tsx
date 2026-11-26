import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { formatShortDate } from '@/lib/date';
import { threadStateColors } from '@/lib/mentalThreadPresentation';
import { useAppTheme } from '@/providers/ThemeProvider';
import type { AttentionState, MentalThread } from '@/types/models';
import { AppText } from '../ui/AppText';
import { Card } from '../ui/Card';
import { SilentPressable } from '../ui/SilentPressable';

const stateIcons = {
  ACTING: 'flash-outline', RUMINATING: 'repeat-outline',
  PLANNED: 'calendar-outline', PENDING: 'hourglass-outline',
} as const satisfies Record<AttentionState, string>;
const closureLabels = { RESOLVED: 'Resolved', ACCEPTED: 'Accepted', RELEASED: 'Released' };

export function ThreadCard({ thread, onPress }: { thread: MentalThread; onPress: () => void }) {
  const { colors } = useAppTheme();
  const closed = thread.status === 'CLOSED';
  const color = closed ? thread.closureType === 'RESOLVED' ? '#2F9D74' : '#6B7280' : threadStateColors[thread.attentionState];
  const label = closed && thread.closureType ? closureLabels[thread.closureType]
    : thread.attentionState[0] + thread.attentionState.slice(1).toLowerCase();
  const date = thread.hardDeadlineDate ?? thread.nextReviewDate ?? thread.targetCloseDate;
  const dateLabel = thread.hardDeadlineDate ? 'Deadline' : thread.nextReviewDate ? 'Review' : 'Target';
  return (
    <SilentPressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      <Card style={[styles.card, { borderLeftColor: color }]}>
        <View style={styles.header}>
          <View style={[styles.badge, { backgroundColor: `${color}18` }]}>
            <Ionicons name={closed ? 'checkmark-circle-outline' : stateIcons[thread.attentionState]} size={15} color={color} />
            <AppText variant="caption" style={{ color }}>{label}</AppText>
          </View>
          <AppText variant="caption" color="muted">{closed ? 'Closed' : thread.currentMentalLoad >= 7 ? 'High load' : thread.currentMentalLoad >= 4 ? 'Moderate load' : 'Light load'}</AppText>
        </View>
        <AppText variant="heading" numberOfLines={2}>{thread.title}</AppText>
        {(thread.resolutionSummary && closed || thread.description) ? <AppText color="muted" numberOfLines={3}>{closed && thread.resolutionSummary || thread.description}</AppText> : null}
        {!closed && thread.desiredResolution ? (
          <View style={[styles.nextStep, { backgroundColor: `${color}0C` }]}>
            <Ionicons name="flag-outline" size={15} color={color} />
            <AppText variant="caption" numberOfLines={2} style={styles.grow}>{thread.desiredResolution}</AppText>
          </View>
        ) : null}
        <View style={styles.header}>
          <AppText variant="caption" color="muted">Mental load</AppText>
          <AppText variant="label" style={{ color }}>{thread.currentMentalLoad}<AppText variant="caption" color="muted"> / 10</AppText></AppText>
        </View>
        <View accessibilityLabel={`Mental load ${thread.currentMentalLoad} out of 10`} style={[styles.track, { backgroundColor: `${color}18` }]}>
          <View style={[styles.bar, { width: `${Math.max(0, Math.min(10, thread.currentMentalLoad)) * 10}%`, backgroundColor: color }]} />
        </View>
        {!closed && date ? <View style={styles.date}><Ionicons name="calendar-outline" size={14} color={colors.textMuted} /><AppText variant="caption" color="muted">{dateLabel} · {formatShortDate(date)}</AppText></View> : null}
      </Card>
    </SilentPressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10, borderWidth: 0, borderLeftWidth: 3, borderRadius: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 9 },
  nextStep: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10 },
  grow: { flex: 1 }, date: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  track: { height: 5, borderRadius: 3, overflow: 'hidden' }, bar: { height: '100%', borderRadius: 3 },
  pressed: { opacity: 0.75 },
});
