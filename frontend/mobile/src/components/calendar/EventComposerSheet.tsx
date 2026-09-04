import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useMemo, useState } from 'react';

import { eventDateInTimeZone, localDate, localDateTimeToInstant } from '@/lib/date';
import { playAudioFeedback } from '@/lib/audioFeedback';
import { reportError } from '@/lib/errors';
import { useAppTheme } from '@/providers/ThemeProvider';
import { api } from '@/services/api';
import type { CalendarEvent, CalendarEventInput, RecurrenceFrequency, RecurrenceUnit } from '@/types/models';
import { AppButton } from '../ui/AppButton';
import { AppInput } from '../ui/AppInput';
import { AppPopup } from '../ui/AppPopup';
import { AppText } from '../ui/AppText';
import { ChoiceChips } from '../ui/ChoiceChips';
import { ModalSheet } from '../ui/ModalSheet';
import { SilentPressable } from '../ui/SilentPressable';

type ReminderValue = string;

const REMINDER_OPTIONS = [
  { value: '5', label: '5 min' },
  { value: '15', label: '15 min' },
  { value: '30', label: '30 min' },
  { value: '60', label: '1 hour' },
  { value: '1440', label: '1 day' },
  { value: '10080', label: '1 week' },
];

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00`);
  return !Number.isNaN(parsed.getTime())
    && `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}` === value;
}

function dateFromCalendarDate(value: string): Date {
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function dateFromTime(value: string): Date {
  const date = new Date();
  const [hours, minutes] = value.split(':').map(Number);
  date.setHours(Number.isNaN(hours) ? 17 : hours, Number.isNaN(minutes) ? 0 : minutes, 0, 0);
  return date;
}

function calendarDateFromDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function calendarTimeFromDate(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function addHour(time: string): { time: string; crossesMidnight: boolean } {
  const [hours, minutes] = time.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes + 60;
  const normalizedMinutes = totalMinutes % (24 * 60);
  return {
    time: `${String(Math.floor(normalizedMinutes / 60)).padStart(2, '0')}:${String(normalizedMinutes % 60).padStart(2, '0')}`,
    crossesMidnight: totalMinutes >= 24 * 60,
  };
}

function addDay(value: string): string {
  const date = dateFromCalendarDate(value);
  date.setDate(date.getDate() + 1);
  return calendarDateFromDate(date);
}

function displayDate(value: string): string {
  const date = dateFromCalendarDate(value);
  return new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function displayTime(value: string): string {
  const date = dateFromTime(value);
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
}

function monthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function sameCalendarDay(first: Date, second: Date): boolean {
  return first.getFullYear() === second.getFullYear()
    && first.getMonth() === second.getMonth()
    && first.getDate() === second.getDate();
}

function CalendarPicker({ value, onChange }: { value: Date; onChange: (value: Date) => void }) {
  const { colors } = useAppTheme();
  const [month, setMonth] = useState(() => monthStart(value));
  const days = useMemo(() => {
    const firstDay = monthStart(month);
    const firstWeekday = firstDay.getDay();
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const cellCount = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
    return Array.from({ length: cellCount }, (_, index) => {
      const dayNumber = index - firstWeekday + 1;
      return dayNumber >= 1 && dayNumber <= daysInMonth
        ? new Date(month.getFullYear(), month.getMonth(), dayNumber)
        : null;
    });
  }, [month]);
  const monthLabel = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(month);

  return (
    <View style={styles.calendar}>
      <View style={styles.calendarHeader}>
        <SilentPressable accessibilityRole="button" accessibilityLabel="Previous month" hitSlop={8} onPress={() => setMonth(current => new Date(current.getFullYear(), current.getMonth() - 1, 1))}>
          <Ionicons name="chevron-back" size={20} color={colors.textMuted} />
        </SilentPressable>
        <AppText variant="label">{monthLabel}</AppText>
        <SilentPressable accessibilityRole="button" accessibilityLabel="Next month" hitSlop={8} onPress={() => setMonth(current => new Date(current.getFullYear(), current.getMonth() + 1, 1))}>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </SilentPressable>
      </View>
      <View style={styles.weekdays}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => <AppText key={`${day}-${index}`} variant="caption" color="muted" style={styles.dayLabel}>{day}</AppText>)}
      </View>
      <View style={styles.calendarGrid}>
        {days.map((day, index) => day ? (
          <SilentPressable
            key={day.toISOString()}
            accessibilityRole="button"
            accessibilityLabel={day.toLocaleDateString()}
            onPress={() => onChange(day)}
            style={[styles.day, sameCalendarDay(day, value) && { backgroundColor: colors.accent }]}>
            <AppText variant="label" style={{ color: sameCalendarDay(day, value) ? colors.onAccent : colors.text }}>{day.getDate()}</AppText>
          </SilentPressable>
        ) : <View key={`empty-${index}`} style={styles.day} />)}
      </View>
    </View>
  );
}

function TimeColumn({ label, values, selected, onSelect }: { label: string; values: number[]; selected: number; onSelect: (value: number) => void }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.timeColumn}>
      <AppText variant="caption" color="muted" style={styles.timeLabel}>{label}</AppText>
      <ScrollView style={styles.timeScroll} contentContainerStyle={styles.timeOptions} showsVerticalScrollIndicator={false}>
        {values.map(value => {
          const selectedValue = value === selected;
          return (
            <SilentPressable
              key={value}
              onPress={() => onSelect(value)}
              style={[styles.timeOption, { backgroundColor: selectedValue ? colors.accent : colors.background, borderColor: selectedValue ? colors.accent : colors.border }]}>
              <AppText variant="label" style={{ color: selectedValue ? colors.onAccent : colors.text }}>{String(value).padStart(2, '0')}</AppText>
            </SilentPressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function TimePicker({ value, onChange }: { value: Date; onChange: (value: Date) => void }) {
  const hours = Array.from({ length: 24 }, (_, value) => value);
  const minutes = Array.from({ length: 60 }, (_, value) => value);
  const update = (hoursValue: number, minutesValue: number) => {
    const next = new Date(value);
    next.setHours(hoursValue, minutesValue, 0, 0);
    onChange(next);
  };

  return (
    <View style={styles.timePicker}>
      <TimeColumn label="HOUR" values={hours} selected={value.getHours()} onSelect={hoursValue => update(hoursValue, value.getMinutes())} />
      <TimeColumn label="MINUTE" values={minutes} selected={value.getMinutes()} onSelect={minutesValue => update(value.getHours(), minutesValue)} />
    </View>
  );
}

function eventTimeInDeviceZone(value: string | null, timeZone: string | undefined, fallback: string): string {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timeZone || undefined,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const hour = parts.find(part => part.type === 'hour')?.value;
  const minute = parts.find(part => part.type === 'minute')?.value;
  return hour && minute ? `${hour}:${minute}` : fallback;
}

function eventDefaults(event: CalendarEvent | null | undefined, initialDate?: string) {
  const date = event
    ? event.allDay ? event.startDate ?? localDate() : eventDateInTimeZone(event.startTime, event.timeZone)
    : initialDate && isCalendarDate(initialDate) ? initialDate : localDate();
  const endDate = event?.allDay
    ? event.endDate ?? date
    : event ? eventDateInTimeZone(event.endTime, event.timeZone) : date;

  return {
    title: event?.title ?? '',
    description: event?.description ?? '',
    date,
    endDate,
    allDay: event?.allDay ? 'yes' as const : 'no' as const,
    startTime: eventTimeInDeviceZone(event?.startTime ?? null, event?.timeZone, '17:00'),
    endTime: eventTimeInDeviceZone(event?.endTime ?? null, event?.timeZone, '18:00'),
    recurrence: event?.recurrenceFrequency ?? 'NONE' as RecurrenceFrequency,
    recurrenceEndDate: event?.recurrenceEndDate ?? '',
    recurrenceInterval: event?.recurrenceInterval ?? 1,
    recurrenceUnit: event?.recurrenceUnit ?? 'WEEKS' as RecurrenceUnit,
    reminder: event ? event.reminderMinutesBefore === null ? 'none' : String(event.reminderMinutesBefore) : '1440',
  };
}

function DateTimeField({ label, value, mode, onChange }: {
  label: string;
  value: string;
  mode: 'date' | 'time';
  onChange: (value: string) => void;
}) {
  const { colors } = useAppTheme();
  const [open, setOpen] = useState(false);
  const pickerValue = mode === 'date' ? dateFromCalendarDate(value) : dateFromTime(value);
  const [draft, setDraft] = useState(pickerValue);
  const shownValue = mode === 'date' ? displayDate(value) : displayTime(value);

  function openPicker() {
    setDraft(pickerValue);
    setOpen(true);
  }

  function save() {
    onChange(mode === 'date' ? calendarDateFromDate(draft) : calendarTimeFromDate(draft));
    setOpen(false);
  }

  return (
    <View style={styles.dateField}>
      <SilentPressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${shownValue}`}
        onPress={openPicker}
        style={({ pressed }) => [styles.dateButton, { borderColor: colors.border, backgroundColor: colors.background }, pressed && styles.pressed]}>
        <AppText variant="caption" color="muted">{label.toUpperCase()}</AppText>
        <AppText variant="label">{shownValue}</AppText>
      </SilentPressable>
      <AppPopup
        visible={open}
        title={label}
        onClose={() => setOpen(false)}
        dismissOnBackdrop={false}
        footer={<View style={styles.popupActions}><AppButton style={styles.popupAction} variant="secondary" label="Cancel" onPress={() => setOpen(false)} /><AppButton style={styles.popupAction} label="Done" onPress={save} /></View>}>
        {mode === 'date'
          ? <CalendarPicker value={draft} onChange={date => setDraft(date)} />
          : <TimePicker value={draft} onChange={date => setDraft(date)} />}
      </AppPopup>
    </View>
  );
}

export function EventComposerSheet({ visible, onClose, event, initialDate, onSaved, onDelete }: {
  visible: boolean;
  onClose: () => void;
  event?: CalendarEvent | null;
  initialDate?: string;
  onSaved: (event: CalendarEvent) => void;
  onDelete?: () => Promise<boolean>;
}) {
  const defaults = eventDefaults(event, initialDate);
  const [title, setTitle] = useState(defaults.title);
  const [description, setDescription] = useState(defaults.description);
  const [date, setDate] = useState(defaults.date);
  const [endDate, setEndDate] = useState(defaults.endDate);
  const [allDay, setAllDay] = useState<'yes' | 'no'>(defaults.allDay);
  const [startTime, setStartTime] = useState(defaults.startTime);
  const [endTime, setEndTime] = useState(defaults.endTime);
  const [recurrence, setRecurrence] = useState<RecurrenceFrequency>(defaults.recurrence);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState(defaults.recurrenceEndDate);
  const [recurrenceInterval, setRecurrenceInterval] = useState(defaults.recurrenceInterval);
  const [recurrenceUnit, setRecurrenceUnit] = useState<RecurrenceUnit>(defaults.recurrenceUnit);
  const [reminder, setReminder] = useState<ReminderValue>(defaults.reminder);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    const next = eventDefaults(null, initialDate);
    setTitle(next.title);
    setDescription(next.description);
    setDate(next.date);
    setEndDate(next.endDate);
    setAllDay(next.allDay);
    setStartTime(next.startTime);
    setEndTime(next.endTime);
    setRecurrence(next.recurrence);
    setRecurrenceEndDate(next.recurrenceEndDate);
    setRecurrenceInterval(next.recurrenceInterval);
    setRecurrenceUnit(next.recurrenceUnit);
    setReminder(next.reminder);
    setError(null);
  }

  function close() {
    reset();
    onClose();
  }

  function handleStartTimeChange(nextStartTime: string) {
    setStartTime(nextStartTime);
    if (!nextStartTime || !endTime || date !== endDate || nextStartTime < endTime) return;
    const adjustedEnd = addHour(nextStartTime);
    setEndTime(adjustedEnd.time);
    if (adjustedEnd.crossesMidnight) setEndDate(addDay(date));
  }

  function handleStartDateChange(nextDate: string) {
    setDate(nextDate);
    if (!nextDate) return;
    if (allDay === 'yes') {
      setEndDate(nextDate);
      return;
    }
    const adjustedEnd = addHour(startTime);
    setEndTime(adjustedEnd.time);
    setEndDate(adjustedEnd.crossesMidnight ? addDay(nextDate) : nextDate);
  }

  async function submit() {
    if (!title.trim()) return setError('Give the event a title.');
    if (!isCalendarDate(date)) return setError('Choose a valid start date.');
    if (allDay === 'yes' && (!isCalendarDate(endDate) || endDate < date)) {
      return setError('The finish date must be on or after the start date.');
    }
    if (recurrence === 'CUSTOM'
      && (!Number.isInteger(recurrenceInterval) || recurrenceInterval < 1 || recurrenceInterval > 999)) {
      return setError('Custom repeat must be between 1 and 999.');
    }
    if (recurrence !== 'NONE' && recurrenceEndDate
      && (!isCalendarDate(recurrenceEndDate) || recurrenceEndDate < date)) {
      return setError('The repeat-until date must be on or after the event date.');
    }

    const startInstant = allDay === 'no' ? localDateTimeToInstant(date, startTime) : null;
    const endInstant = allDay === 'no' ? localDateTimeToInstant(endDate, endTime) : null;
    if (allDay === 'no' && (!startInstant || !endInstant || new Date(endInstant) <= new Date(startInstant))) {
      return setError('The end time must be after the start time.');
    }

    setSaving(true);
    setError(null);
    const input: CalendarEventInput = {
      title: title.trim(),
      description: description.trim(),
      allDay: allDay === 'yes',
      startDate: allDay === 'yes' ? date : null,
      endDate: allDay === 'yes' ? endDate : null,
      startTime: startInstant,
      endTime: endInstant,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      recurrenceFrequency: recurrence,
      recurrenceEndDate: recurrence === 'NONE' ? null : recurrenceEndDate || null,
      recurrenceInterval: recurrence === 'CUSTOM' ? recurrenceInterval : null,
      recurrenceUnit: recurrence === 'CUSTOM' ? recurrenceUnit : null,
      reminderMinutesBefore: reminder === 'none' ? null : Number(reminder),
    };

    try {
      const saved = event ? await api.events.update(event.id, input) : await api.events.create(input);
      onSaved(saved);
      if (!event) playAudioFeedback('eventCreated');
      close();
    } catch (cause) {
      setError(reportError(event ? 'Could not save event' : 'Could not create event', cause));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!onDelete || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      if (await onDelete()) close();
    } catch (cause) {
      setError(reportError('Could not delete event', cause));
    } finally {
      setDeleting(false);
    }
  }

  const reminderOptions = [
    { value: 'none', label: 'No reminder' },
    ...REMINDER_OPTIONS,
    ...(reminder !== 'none' && !REMINDER_OPTIONS.some(option => option.value === reminder)
      ? [{ value: reminder, label: `${reminder} min` }]
      : []),
  ];

  return (
    <ModalSheet
      visible={visible}
      onClose={close}
      title={event ? 'Edit event' : 'New event'}
      footer={(
        <View style={styles.footerActions}>
          {event && onDelete && <AppButton style={styles.footerAction} label="Delete" icon="trash-outline" variant="danger" disabled={saving} loading={deleting} onPress={() => void remove()} />}
          <AppButton style={styles.footerAction} label={event ? 'Save event' : 'Add event'} icon="calendar-outline" loading={saving} disabled={deleting} onPress={() => void submit()} />
        </View>
      )}>
      <AppInput autoFocus label="Event" value={title} onChangeText={setTitle} error={error ?? undefined} />
      <AppInput label="Details (optional)" multiline value={description} onChangeText={setDescription} />
      <AppText variant="label">When</AppText>
      <ChoiceChips value={allDay} onChange={setAllDay} options={[{ value: 'no', label: 'Timed' }, { value: 'yes', label: 'All day' }]} />
      <View style={styles.fieldRow}>
        <DateTimeField label="Starts" value={date} mode="date" onChange={handleStartDateChange} />
        {allDay === 'no' && <DateTimeField label="Starts at" value={startTime} mode="time" onChange={handleStartTimeChange} />}
      </View>
      <View style={styles.fieldRow}>
        <DateTimeField label="Finishes" value={endDate} mode="date" onChange={setEndDate} />
        {allDay === 'no' && <DateTimeField label="Finishes at" value={endTime} mode="time" onChange={setEndTime} />}
      </View>
      <AppText variant="label">Repeat</AppText>
      <ChoiceChips value={recurrence} onChange={value => { setRecurrence(value); if (value === 'NONE') setRecurrenceEndDate(''); }} options={[
        { value: 'NONE' as const, label: 'Never' }, { value: 'DAILY' as const, label: 'Daily' },
        { value: 'WEEKLY' as const, label: 'Weekly' }, { value: 'MONTHLY' as const, label: 'Monthly' },
        { value: 'CUSTOM' as const, label: 'Custom' },
      ]} />
      {recurrence === 'CUSTOM' && (
        <>
          <AppInput label="Repeat every" value={String(recurrenceInterval)} onChangeText={value => setRecurrenceInterval(Number(value))} keyboardType="number-pad" />
          <ChoiceChips value={recurrenceUnit} onChange={setRecurrenceUnit} options={[
            { value: 'DAYS' as const, label: 'Days' }, { value: 'WEEKS' as const, label: 'Weeks' }, { value: 'MONTHS' as const, label: 'Months' },
          ]} />
        </>
      )}
      {recurrence !== 'NONE' && <DateTimeField label="Repeat until (optional)" value={recurrenceEndDate || date} mode="date" onChange={setRecurrenceEndDate} />}
      <AppText variant="label">Reminder</AppText>
      <ChoiceChips value={reminder} onChange={setReminder} options={reminderOptions} />
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  fieldRow: { flexDirection: 'row', gap: 10 },
  dateField: { flex: 1, gap: 8 },
  dateButton: { minHeight: 58, paddingHorizontal: 13, paddingVertical: 10, borderWidth: 1, borderRadius: 14, justifyContent: 'center', gap: 4 },
  calendar: { gap: 13 },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  weekdays: { flexDirection: 'row' },
  dayLabel: { flex: 1, textAlign: 'center' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 7 },
  day: { width: '14.2857%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  timePicker: { flexDirection: 'row', gap: 12 },
  timeColumn: { flex: 1, gap: 8 },
  timeLabel: { textAlign: 'center' },
  timeScroll: { height: 220 },
  timeOptions: { gap: 7 },
  timeOption: { minHeight: 40, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  popupActions: { flexDirection: 'row', gap: 10 },
  popupAction: { flex: 1 },
  footerActions: { flexDirection: 'row', gap: 10 },
  footerAction: { flex: 1 },
  pressed: { opacity: 0.72 },
});
