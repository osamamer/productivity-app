import { useState } from 'react';

import { localDate } from '@/lib/date';
import { api } from '@/services/api';
import type { CalendarEvent } from '@/types/models';
import { AppButton } from '../ui/AppButton';
import { AppInput } from '../ui/AppInput';
import { AppText } from '../ui/AppText';
import { ChoiceChips } from '../ui/ChoiceChips';
import { ModalSheet } from '../ui/ModalSheet';

export function EventComposerSheet({ visible, onClose, onCreated }: {
  visible: boolean;
  onClose: () => void;
  onCreated: (event: CalendarEvent) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(localDate());
  const [allDay, setAllDay] = useState<'yes' | 'no'>('no');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [recurrence, setRecurrence] = useState<'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY'>('NONE');
  const [reminder, setReminder] = useState<'none' | '10' | '30' | '60'>('10');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setTitle('');
    setDescription('');
    setDate(localDate());
    setAllDay('no');
    setStartTime('09:00');
    setEndTime('10:00');
    setRecurrence('NONE');
    setReminder('10');
    setError(null);
  }

  function close() {
    reset();
    onClose();
  }

  async function submit() {
    if (!title.trim()) return setError('Give the event a title.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError('Use date format YYYY-MM-DD.');
    if (allDay === 'no' && (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime))) {
      return setError('Use time format HH:MM.');
    }
    setSaving(true);
    setError(null);
    try {
      const event = await api.events.create({
        title: title.trim(),
        description: description.trim(),
        allDay: allDay === 'yes',
        startDate: date,
        endDate: date,
        startTime: allDay === 'yes' ? null : startTime,
        endTime: allDay === 'yes' ? null : endTime,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        recurrenceFrequency: recurrence,
        recurrenceEndDate: null,
        reminderMinutesBefore: reminder === 'none' ? null : Number(reminder),
      });
      onCreated(event);
      close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create the event.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalSheet
      visible={visible}
      onClose={close}
      title="New event"
      footer={<AppButton label="Add event" icon="calendar-outline" loading={saving} onPress={() => void submit()} />}>
      <AppInput autoFocus label="Event" value={title} onChangeText={setTitle} error={error ?? undefined} />
      <AppInput label="Details (optional)" multiline value={description} onChangeText={setDescription} />
      <AppInput label="Date · YYYY-MM-DD" value={date} onChangeText={setDate} keyboardType="numbers-and-punctuation" />
      <AppText variant="label">Timing</AppText>
      <ChoiceChips value={allDay} onChange={setAllDay} options={[{ value: 'no', label: 'Timed' }, { value: 'yes', label: 'All day' }]} />
      {allDay === 'no' && (
        <>
          <AppInput label="Starts · HH:MM" value={startTime} onChangeText={setStartTime} keyboardType="numbers-and-punctuation" />
          <AppInput label="Ends · HH:MM" value={endTime} onChangeText={setEndTime} keyboardType="numbers-and-punctuation" />
        </>
      )}
      <AppText variant="label">Repeat</AppText>
      <ChoiceChips value={recurrence} onChange={setRecurrence} options={[
        { value: 'NONE', label: 'Never' }, { value: 'DAILY', label: 'Daily' },
        { value: 'WEEKLY', label: 'Weekly' }, { value: 'MONTHLY', label: 'Monthly' },
      ]} />
      <AppText variant="label">Reminder</AppText>
      <ChoiceChips value={reminder} onChange={setReminder} options={[
        { value: 'none', label: 'None' }, { value: '10', label: '10 min' },
        { value: '30', label: '30 min' }, { value: '60', label: '1 hour' },
      ]} />
    </ModalSheet>
  );
}
