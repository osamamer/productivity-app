import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { EventComposerSheet } from '@/components/calendar/EventComposerSheet';
import { AppButton } from '@/components/ui/AppButton';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { EmptyView, ErrorView, LoadingView } from '@/components/ui/StateView';
import { useAsyncData } from '@/hooks/useAsyncData';
import { calendarDateParts, eventDateInTimeZone, formatCalendarDate, formatCalendarTime, localDate } from '@/lib/date';
import { reportError } from '@/lib/errors';
import { useAppPopup } from '@/providers/PopupProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { api } from '@/services/api';
import type { CalendarEvent } from '@/types/models';

export default function CalendarScreen() {
  const { colors } = useAppTheme();
  const { confirm, showError } = useAppPopup();
  const resource = useAsyncData(() => api.events.all());
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [now] = useState(() => new Date());
  const today = localDate(now);
  const events = useMemo(() => [...(resource.data ?? [])]
    .filter(event => {
      const startDate = eventDateInTimeZone(event.startTime, event.timeZone);
      const lastDate = event.allDay
        ? event.endDate ?? event.startDate
        : event.recurrenceEndDate ?? startDate;
      if (!lastDate) return true;
      if (event.recurrenceFrequency !== 'NONE') return !event.recurrenceEndDate || event.recurrenceEndDate >= today;
      if (event.allDay) return lastDate >= today;
      const finish = event.endTime ?? event.startTime;
      return finish ? new Date(finish).getTime() >= now.getTime() : true;
    })
    .sort((a, b) => {
      const aDate = eventDateInTimeZone(a.allDay ? a.startDate : a.startTime, a.timeZone);
      const bDate = eventDateInTimeZone(b.allDay ? b.startDate : b.startTime, b.timeZone);
      return `${aDate}${a.startTime ?? ''}`.localeCompare(`${bDate}${b.startTime ?? ''}`);
    }), [now, resource.data, today]);

  function scheduleLabel(event: CalendarEvent): string {
    const start = event.allDay ? event.startDate : event.startTime;
    if (!start) return 'Date not set';
    const date = event.allDay && event.startDate && event.endDate && event.endDate !== event.startDate
      ? `${formatCalendarDate(event.startDate)} – ${formatCalendarDate(event.endDate)}`
      : formatCalendarDate(start, event.timeZone);
    if (event.allDay) return `${date} · All day`;
    const startTime = formatCalendarTime(event.startTime, event.timeZone);
    const endTime = formatCalendarTime(event.endTime, event.timeZone);
    return `${date} · ${startTime}${endTime ? `–${endTime}` : ''}`;
  }

  async function remove(event: CalendarEvent) {
    if (!await confirm('Delete event?', event.title, 'Delete')) return;
    try {
      await api.events.remove(event.id);
      resource.setData(current => current?.filter(item => item.id !== event.id) ?? current);
    } catch (cause) {
      void showError('Could not delete event', reportError('Could not delete event', cause));
    }
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
          <AppText variant="heading">Upcoming schedule</AppText>
          <AppText color="muted">{new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(new Date())} · {events.length} {events.length === 1 ? 'event' : 'events'}</AppText>
        </View>
      </Card>
      {resource.loading && <LoadingView label="Loading your calendar…" />}
      {resource.error && !resource.data && <ErrorView message={resource.error} retry={() => void resource.reload()} />}
      {!resource.loading && resource.data && !events.length && <EmptyView title="Nothing on the horizon" message="Add an event when something earns a place on your calendar." />}
      <View style={styles.list}>
        {events.map(event => {
          const parts = calendarDateParts(event.allDay ? event.startDate : event.startTime, event.timeZone);
          return (
            <Pressable
              key={event.id}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${event.title}`}
              onPress={() => setEditingEvent(event)}
              style={({ pressed }) => pressed && styles.pressed}>
              <Card style={styles.event}>
                <View style={[styles.dateTile, { backgroundColor: colors.accentSoft }]}>
                  {parts ? (
                    <>
                      <AppText variant="caption" color="accent">{parts.weekday}</AppText>
                      <AppText variant="title" color="accent">{parts.day}</AppText>
                      <AppText variant="caption" color="accent">{parts.month}</AppText>
                    </>
                  ) : <Ionicons name="calendar-outline" size={22} color={colors.accent} />}
                </View>
                <View style={styles.grow}>
                  <AppText variant="label" numberOfLines={2}>{event.title}</AppText>
                  <AppText variant="caption" color="muted" numberOfLines={2}>
                    {scheduleLabel(event)}
                    {event.recurrenceFrequency !== 'NONE' ? ` · ${event.recurrenceFrequency.toLowerCase()}` : ''}
                  </AppText>
                  {event.reminderMinutesBefore !== null && (
                    <AppText variant="caption" color="accent">Reminder · {event.reminderMinutesBefore < 60 ? `${event.reminderMinutesBefore} min` : `${Math.round(event.reminderMinutesBefore / 60)} hr`}</AppText>
                  )}
                  {event.description ? <AppText color="muted" numberOfLines={2}>{event.description}</AppText> : null}
                </View>
                <View style={styles.actions}>
                  <Pressable hitSlop={10} accessibilityLabel={`Edit ${event.title}`} onPress={pressEvent => { pressEvent.stopPropagation(); setEditingEvent(event); }}>
                    <Ionicons name="pencil-outline" size={18} color={colors.accent} />
                  </Pressable>
                  <Pressable hitSlop={10} accessibilityLabel={`Delete ${event.title}`} onPress={pressEvent => { pressEvent.stopPropagation(); remove(event); }}>
                    <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
                  </Pressable>
                </View>
              </Card>
            </Pressable>
          );
        })}
      </View>
      <EventComposerSheet
        key={editingEvent?.id ?? 'new-event'}
        visible={composerOpen || Boolean(editingEvent)}
        event={editingEvent}
        onClose={() => { setComposerOpen(false); setEditingEvent(null); }}
        onSaved={saved => resource.setData(current => {
          if (!current) return [saved];
          return editingEvent
            ? current.map(event => event.id === saved.id ? saved : event)
            : [...current, saved];
        })}
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
  dateTile: { width: 58, minHeight: 70, borderRadius: 15, alignItems: 'center', justifyContent: 'center', paddingVertical: 7 },
  actions: { gap: 14, alignItems: 'center' },
  pressed: { opacity: 0.76 },
});
