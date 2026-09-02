import { useState } from 'react';

import { eventDateInTimeZone, localDate, localDateTimeToInstant } from '@/lib/date';
import { reportError } from '@/lib/errors';
import { api } from '@/services/api';
import type { CalendarEvent, CalendarEventInput, RecurrenceFrequency, RecurrenceUnit } from '@/types/models';
import { AppButton } from '../ui/AppButton';
import { AppInput } from '../ui/AppInput';
import { AppText } from '../ui/AppText';
import { ChoiceChips } from '../ui/ChoiceChips';
import { ModalSheet } from '../ui/ModalSheet';

type ReminderValue = string;

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00`);
  return !Number.isNaN(parsed.getTime())
    && `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}` === value;
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

function eventDefaults(event: CalendarEvent | null | undefined) {
  const date = event
    ? event.allDay
      ? event.startDate ?? localDate()
      : eventDateInTimeZone(event.startTime, event.timeZone)
    : localDate();

  return {
    title: event?.title ?? '',
    description: event?.description ?? '',
    date,
    endDate: event?.allDay ? event.endDate ?? date : date,
    allDay: event?.allDay ? 'yes' as const : 'no' as const,
    startTime: eventTimeInDeviceZone(event?.startTime ?? null, event?.timeZone, '09:00'),
    endTime: eventTimeInDeviceZone(event?.endTime ?? null, event?.timeZone, '10:00'),
    recurrence: event?.recurrenceFrequency ?? 'NONE' as RecurrenceFrequency,
    recurrenceEndDate: event?.recurrenceEndDate ?? '',
    recurrenceInterval: event?.recurrenceInterval ?? 1,
    recurrenceUnit: event?.recurrenceUnit ?? 'WEEKS' as RecurrenceUnit,
    reminder: event?.reminderMinutesBefore === null || event?.reminderMinutesBefore === undefined
      ? 'none'
      : String(event.reminderMinutesBefore),
  };
}

export function EventComposerSheet({ visible, onClose, event, onSaved }: {
  visible: boolean;
  onClose: () => void;
  event?: CalendarEvent | null;
  onSaved: (event: CalendarEvent) => void;
}) {
  const defaults = eventDefaults(event);
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
  const [error, setError] = useState<string | null>(null);

  function reset() {
    const defaults = eventDefaults(null);
    setTitle(defaults.title);
    setDescription(defaults.description);
    setDate(defaults.date);
    setEndDate(defaults.endDate);
    setAllDay(defaults.allDay);
    setStartTime(defaults.startTime);
    setEndTime(defaults.endTime);
    setRecurrence(defaults.recurrence);
    setRecurrenceEndDate(defaults.recurrenceEndDate);
    setRecurrenceInterval(defaults.recurrenceInterval);
    setRecurrenceUnit(defaults.recurrenceUnit);
    setReminder(defaults.reminder);
    setError(null);
  }

  function close() {
    reset();
    onClose();
  }

  async function submit() {
    if (!title.trim()) return setError('Give the event a title.');
    if (recurrence === 'CUSTOM'
      && (!Number.isInteger(recurrenceInterval) || recurrenceInterval < 1 || recurrenceInterval > 999)) {
      return setError('Custom repeat must be between 1 and 999.');
    }
    if (!isCalendarDate(date)) return setError('Use a valid date in YYYY-MM-DD format.');
    if (allDay === 'yes' && (!isCalendarDate(endDate) || endDate < date)) {
      return setError('The finish date must be on or after the start date.');
    }
    if (allDay === 'no' && (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime))) {
      return setError('Use time format HH:MM.');
    }

    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const startInstant = allDay === 'no' ? localDateTimeToInstant(date, startTime) : null;
    const endInstant = allDay === 'no' ? localDateTimeToInstant(date, endTime) : null;
    if (allDay === 'no' && (!startInstant || !endInstant || new Date(endInstant) <= new Date(startInstant))) {
      return setError('The end time must be after the start time.');
    }
    if (recurrence !== 'NONE' && recurrenceEndDate
      && (!isCalendarDate(recurrenceEndDate) || recurrenceEndDate < date)) {
      return setError('The repeat-until date must be on or after the event date.');
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
      timeZone,
      recurrenceFrequency: recurrence,
      recurrenceEndDate: recurrence === 'NONE' ? null : recurrenceEndDate || null,
      recurrenceInterval: recurrence === 'CUSTOM' ? recurrenceInterval : null,
      recurrenceUnit: recurrence === 'CUSTOM' ? recurrenceUnit : null,
      reminderMinutesBefore: reminder === 'none' ? null : Number(reminder),
    };

    try {
      const saved = event
        ? await api.events.update(event.id, input)
        : await api.events.create(input);
      onSaved(saved);
      close();
    } catch (cause) {
      setError(reportError(event ? 'Could not save event' : 'Could not create event', cause));
    } finally {
      setSaving(false);
    }
  }

  const reminderOptions = [
    { value: 'none', label: 'None' },
    { value: '10', label: '10 min' },
    { value: '30', label: '30 min' },
    { value: '60', label: '1 hour' },
    { value: '1440', label: '1 day' },
    ...(reminder !== 'none' && !['10', '30', '60', '1440'].includes(reminder)
      ? [{ value: reminder, label: `${reminder} min` }]
      : []),
  ];

  return (
    <ModalSheet
      visible={visible}
      onClose={close}
      title={event ? 'Edit event' : 'New event'}
      footer={<AppButton label={event ? 'Save event' : 'Add event'} icon="calendar-outline" loading={saving} onPress={() => void submit()} />}>
      <AppInput autoFocus label="Event" value={title} onChangeText={setTitle} error={error ?? undefined} />
      <AppInput label="Details (optional)" multiline value={description} onChangeText={setDescription} />
      <AppInput label="Starts · YYYY-MM-DD" value={date} onChangeText={setDate} keyboardType="numbers-and-punctuation" />
      <AppText variant="label">Timing</AppText>
      <ChoiceChips value={allDay} onChange={setAllDay} options={[{ value: 'no', label: 'Timed' }, { value: 'yes', label: 'All day' }]} />
      {allDay === 'yes' ? (
        <AppInput label="Finishes · YYYY-MM-DD" value={endDate} onChangeText={setEndDate} keyboardType="numbers-and-punctuation" />
      ) : (
        <>
          <AppInput label="Starts · HH:MM" value={startTime} onChangeText={setStartTime} keyboardType="numbers-and-punctuation" />
          <AppInput label="Ends · HH:MM" value={endTime} onChangeText={setEndTime} keyboardType="numbers-and-punctuation" />
        </>
      )}
      <AppText variant="label">Repeat</AppText>
      <ChoiceChips value={recurrence} onChange={setRecurrence} options={[
        { value: 'NONE' as const, label: 'Never' }, { value: 'DAILY' as const, label: 'Daily' },
        { value: 'WEEKLY' as const, label: 'Weekly' }, { value: 'MONTHLY' as const, label: 'Monthly' },
        { value: 'CUSTOM' as const, label: 'Custom' },
      ]} />
      {recurrence === 'CUSTOM' && (
        <>
          <AppInput label="Repeat every" value={String(recurrenceInterval)}
            onChangeText={value => setRecurrenceInterval(Number(value))} keyboardType="number-pad" />
          <ChoiceChips value={recurrenceUnit} onChange={setRecurrenceUnit} options={[
            { value: 'DAYS' as const, label: 'Days' },
            { value: 'WEEKS' as const, label: 'Weeks' },
            { value: 'MONTHS' as const, label: 'Months' },
          ]} />
        </>
      )}
      {recurrence !== 'NONE' && (
        <AppInput label="Repeat until · YYYY-MM-DD (optional)" value={recurrenceEndDate} onChangeText={setRecurrenceEndDate} keyboardType="numbers-and-punctuation" />
      )}
      <AppText variant="label">Reminder</AppText>
      <ChoiceChips value={reminder} onChange={setReminder} options={reminderOptions} />
    </ModalSheet>
  );
}
