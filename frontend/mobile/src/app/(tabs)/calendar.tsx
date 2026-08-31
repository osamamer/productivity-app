import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { EventComposerSheet } from '@/components/calendar/EventComposerSheet';
import { AppButton } from '@/components/ui/AppButton';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { EmptyView, ErrorView, LoadingView } from '@/components/ui/StateView';
import { useAsyncData } from '@/hooks/useAsyncData';
import { formatShortDate, localDate } from '@/lib/date';
import { useAppTheme } from '@/providers/ThemeProvider';
import { api } from '@/services/api';
import type { CalendarEvent } from '@/types/models';

export default function CalendarScreen() {
  const { colors } = useAppTheme();
  const resource = useAsyncData(() => api.events.all());
  const [composerOpen, setComposerOpen] = useState(false);
  const events = useMemo(() => [...(resource.data ?? [])]
    .filter(event => !event.endDate || event.endDate >= localDate())
    .sort((a, b) => `${a.startDate}${a.startTime}`.localeCompare(`${b.startDate}${b.startTime}`)), [resource.data]);

  function remove(event: CalendarEvent) {
    Alert.alert('Delete event?', event.title, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: () => void api.events.remove(event.id)
          .then(() => resource.setData(current => current?.filter(item => item.id !== event.id) ?? current))
          .catch(cause => Alert.alert('Could not delete event', cause instanceof Error ? cause.message : undefined)),
      },
    ]);
  }

  return (
    <Screen
      title="Calendar"
      eyebrow="What’s ahead"
      action={<AppButton compact label="Event" icon="add" onPress={() => setComposerOpen(true)} />}
      refreshing={resource.refreshing}
      onRefresh={() => void resource.reload()}>
      <Card style={styles.monthCard}>
        <View style={styles.monthIcon}><Ionicons name="calendar" size={25} color={colors.accent} /></View>
        <View style={styles.grow}>
          <AppText variant="heading">{new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(new Date())}</AppText>
          <AppText color="muted">{events.length} upcoming {events.length === 1 ? 'event' : 'events'}</AppText>
        </View>
      </Card>
      {resource.loading && <LoadingView label="Loading your calendar…" />}
      {resource.error && !resource.data && <ErrorView message={resource.error} retry={() => void resource.reload()} />}
      {!resource.loading && resource.data && !events.length && <EmptyView title="Nothing on the horizon" message="Add an event when something earns a place on your calendar." />}
      <View style={styles.list}>
        {events.map(event => (
          <Card key={event.id} style={styles.event}>
            <View style={[styles.dateTile, { backgroundColor: colors.accentSoft }]}>
              <AppText variant="caption" color="accent">{formatShortDate(event.startDate).split(' ')[0]}</AppText>
              <AppText variant="heading" color="accent">{event.startDate?.slice(-2)}</AppText>
            </View>
            <View style={styles.grow}>
              <AppText variant="label">{event.title}</AppText>
              <AppText variant="caption" color="muted">
                {event.allDay ? 'All day' : `${event.startTime?.slice(0, 5)}–${event.endTime?.slice(0, 5)}`}
                {event.recurrenceFrequency !== 'NONE' ? ` · ${event.recurrenceFrequency.toLowerCase()}` : ''}
              </AppText>
              {event.description ? <AppText color="muted" numberOfLines={2}>{event.description}</AppText> : null}
            </View>
            <Pressable hitSlop={12} onPress={() => remove(event)}><Ionicons name="trash-outline" size={18} color={colors.textMuted} /></Pressable>
          </Card>
        ))}
      </View>
      <EventComposerSheet
        visible={composerOpen}
        onClose={() => setComposerOpen(false)}
        onCreated={event => resource.setData(current => current ? [...current, event] : [event])}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  monthCard: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  monthIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  grow: { flex: 1, gap: 3 },
  list: { gap: 10 },
  event: { flexDirection: 'row', gap: 13, alignItems: 'center', padding: 14 },
  dateTile: { width: 52, height: 58, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
});
