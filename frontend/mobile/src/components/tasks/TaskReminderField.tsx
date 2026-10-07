import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { formatShortDate, formatTime } from '@/lib/date';
import { AppButton } from '../ui/AppButton';
import { AppPopup } from '../ui/AppPopup';
import { AppText } from '../ui/AppText';
import { ChoiceChips } from '../ui/ChoiceChips';
import { TaskDateTimePicker } from './TaskScheduleField';

const PRESET_REMINDER_OPTIONS = [
  { value: 60, label: '1 hour before' },
  { value: 1440, label: '1 day before' },
] as const;
const MAX_REMINDER_MINUTES = 8 * 7 * 24 * 60;

type ReminderChoice = 'none' | 'custom' | 60 | 1440;

function isPreset(value: number | null | undefined): value is 60 | 1440 {
  return value === 60 || value === 1440;
}

function scheduledDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function customReminderDate(value: string | null | undefined, minutesBefore: number | null): Date {
  const scheduledAt = scheduledDate(value);
  if (!scheduledAt) return new Date();
  scheduledAt.setMinutes(scheduledAt.getMinutes() - (minutesBefore ?? 60));
  return scheduledAt;
}

export function TaskReminderField({ value, scheduledDateTime, onChange }: {
  value: number | null;
  scheduledDateTime: string | null | undefined;
  onChange: (value: number | null) => void;
}) {
  const [customOpen, setCustomOpen] = useState(false);
  const [customDraft, setCustomDraft] = useState(() => customReminderDate(scheduledDateTime, null));
  const [error, setError] = useState<string | null>(null);
  const customValue = value != null && !isPreset(value);
  const selectedChoice: ReminderChoice = customValue
    ? 'custom'
    : isPreset(value) ? value : 'none';
  const selectedReminderAt = customValue && scheduledDateTime
    ? customReminderDate(scheduledDateTime, value)
    : null;

  function choose(choice: ReminderChoice) {
    setError(null);
    if (choice === 'custom') {
      if (!scheduledDate(scheduledDateTime)) {
        setError('Schedule the task before choosing a custom reminder.');
        return;
      }
      setCustomDraft(customReminderDate(scheduledDateTime, customValue ? value : null));
      setCustomOpen(true);
      return;
    }

    onChange(choice === 'none' ? null : choice);
  }

  function confirmCustomReminder() {
    const scheduledAt = scheduledDate(scheduledDateTime);
    if (!scheduledAt) {
      setError('Schedule the task before choosing a custom reminder.');
      return;
    }

    const reminderAt = new Date(customDraft);
    const minutesBefore = (scheduledAt.getTime() - reminderAt.getTime()) / (60 * 1000);
    if (!Number.isInteger(minutesBefore) || minutesBefore < 0) {
      setError('The reminder must be at or before the task time.');
      return;
    }
    if (minutesBefore > MAX_REMINDER_MINUTES) {
      setError('The reminder can be at most eight weeks before the task.');
      return;
    }

    onChange(minutesBefore);
    setCustomOpen(false);
    setError(null);
  }

  return (
    <View style={styles.container}>
      <AppText variant="label">Remind me</AppText>
      <ChoiceChips
        value={selectedChoice}
        onChange={choose}
        options={[
          { value: 'none' as const, label: 'None' },
          ...PRESET_REMINDER_OPTIONS,
          { value: 'custom' as const, label: 'Custom' },
        ]} />
      {selectedReminderAt && (
        <AppText variant="caption" color="muted">
          {`Custom · ${formatShortDate(selectedReminderAt.toISOString())} at ${formatTime(selectedReminderAt.toISOString())}`}
        </AppText>
      )}
      {error && <AppText variant="caption" color="danger">{error}</AppText>}
      <AppPopup
        visible={customOpen}
        title="Custom reminder"
        showIcon={false}
        onClose={() => { setCustomOpen(false); setError(null); }}
        dismissOnBackdrop={false}
        footer={(
          <View style={styles.popupActions}>
            <AppButton style={styles.popupAction} variant="secondary" label="Cancel" onPress={() => { setCustomOpen(false); setError(null); }} />
            <AppButton style={styles.popupAction} label="Set reminder" onPress={confirmCustomReminder} />
          </View>
        )}>
        <AppText variant="label">Reminder time</AppText>
        <TaskDateTimePicker
          key={`${customOpen}-${value ?? ''}-${scheduledDateTime ?? ''}`}
          value={customDraft}
          onChange={setCustomDraft}
        />
        {error && <AppText variant="caption" color="danger">{error}</AppText>}
      </AppPopup>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  popupActions: { flexDirection: 'row', gap: 10 },
  popupAction: { flex: 1 },
});
