import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { repeatSummary } from '../../../../../shared/repeatRule';
import {
  describeChange,
  reminderLabel,
  scheduleOf,
  whenDraftFromSchedule,
  type ChangeScope,
  type WhenChange,
  type WhenDraft,
} from '../../../../../shared/whenDraft';
import { localDate } from '@/lib/date';
import { useAppTheme } from '@/providers/ThemeProvider';
import { AppButton } from '../../ui/AppButton';
import { AppText } from '../../ui/AppText';
import { ChoiceChips } from '../../ui/ChoiceChips';
import { ModalSheet } from '../../ui/ModalSheet';
import { SilentPressable } from '../../ui/SilentPressable';
import { TaskReminderField } from '../TaskReminderField';
import { TaskScheduleField } from '../TaskScheduleField';
import { RepeatEditor } from './RepeatEditor';

type Tab = 'when' | 'repeat';

const SCOPES = [
  { value: 'occurrence' as const, label: 'This occurrence' },
  { value: 'all' as const, label: 'All occurrences' },
];

function dayOffset(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return localDate(date);
}

/** "Fri 28 Nov, 09:00", with the year when it is not this year. */
export function scheduleLabel(draft: WhenDraft): string {
  if (!draft.date) return 'No date';
  const date = new Date(`${draft.date}T12:00:00`);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  const day = new Intl.DateTimeFormat(undefined, {
    weekday: 'short', day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }),
  }).format(date);
  return `${day}, ${draft.time}`;
}

/**
 * One row that always stays the same height, with the date and time, the repeat and the reminder. Tapping it
 * opens a sheet with a Date and time tab and a Repeat tab; nothing is saved until Done.
 */
export function TaskWhenField({ value, repeating, canRepeat, showRepeatSubtasks, onSave }: {
  value: WhenDraft;
  /** An existing series: date, time and reminder changes ask "this occurrence or all". */
  repeating: boolean;
  canRepeat: boolean;
  showRepeatSubtasks: boolean;
  onSave: (change: WhenChange) => Promise<void>;
}) {
  const { colors } = useAppTheme();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('when');
  const [draft, setDraft] = useState(value);
  const [scheduleScope, setScheduleScope] = useState<ChangeScope>('occurrence');
  const [reminderScope, setReminderScope] = useState<ChangeScope>('occurrence');
  const [saving, setSaving] = useState(false);

  const change = describeChange(value, draft, { scheduleScope, reminderScope });
  const askScope = repeating && value.repeat.kind !== 'NONE';
  const repeats = canRepeat && value.repeat.kind !== 'NONE';
  const update = (changes: Partial<WhenDraft>) => setDraft(previous => {
    const next = { ...previous, ...changes };
    return next.date ? next : { ...next, reminderMinutesBefore: null };
  });

  function openSheet() {
    setDraft(value);
    setTab('when');
    setScheduleScope('occurrence');
    setReminderScope('occurrence');
    setOpen(true);
  }

  async function save() {
    if (!change.scheduleChanged && !change.reminderChanged && !change.repeatChanged) {
      setOpen(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(change);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  const muted = colors.textMuted;
  return (
    <>
      <SilentPressable
        accessibilityRole="button"
        accessibilityLabel={`When: ${scheduleLabel(value)}, ${repeatSummary(value.repeat)}, ${reminderLabel(value.reminderMinutesBefore)}`}
        onPress={openSheet}
        style={({ pressed }) => [styles.row, { borderColor: colors.border, backgroundColor: colors.background }, pressed && styles.pressed]}>
        <View style={styles.segment}>
          <Ionicons name="calendar-outline" size={17} color={muted} />
          <AppText variant="label" numberOfLines={1} color={value.date ? 'default' : 'muted'}>{scheduleLabel(value)}</AppText>
        </View>
        {canRepeat && (
          <View style={[styles.segment, styles.growSegment, { borderLeftColor: colors.border }]}>
            <Ionicons name="repeat" size={17} color={muted} />
            <AppText variant="label" numberOfLines={1} style={styles.shrink} color={repeats ? 'default' : 'muted'}>
              {repeats ? repeatSummary(value.repeat, true) : 'No repeat'}
            </AppText>
          </View>
        )}
        <View style={[styles.segment, { borderLeftColor: colors.border }, !canRepeat && styles.growSegment]}>
          <Ionicons name="notifications-outline" size={17} color={value.reminderMinutesBefore === null ? muted : colors.accent} />
          {!repeats && value.reminderMinutesBefore !== null && (
            <AppText variant="label" numberOfLines={1}>{reminderLabel(value.reminderMinutesBefore, true)}</AppText>
          )}
        </View>
      </SilentPressable>

      <ModalSheet
        visible={open}
        title="When"
        onClose={() => setOpen(false)}
        footer={<AppButton label="Done" loading={saving} disabled={draft.repeat.kind !== 'NONE' && !draft.date} onPress={() => void save()} />}>
        <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
          {(['when', 'repeat'] as const).filter(item => item === 'when' || canRepeat).map(item => (
            <SilentPressable
              key={item}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === item }}
              onPress={() => setTab(item)}
              style={[styles.tab, tab === item && { borderBottomColor: colors.text }]}>
              <AppText variant="label" color={tab === item ? 'default' : 'muted'}>{item === 'when' ? 'Date and time' : 'Repeat'}</AppText>
            </SilentPressable>
          ))}
        </View>
        {tab === 'when' ? (
          <View style={styles.tabBody}>
            <ChoiceChips
              value={draft.date === dayOffset(0) ? 'today' : draft.date === dayOffset(1) ? 'tomorrow' : draft.date === dayOffset(7) ? 'week' : draft.date ? 'other' : 'none'}
              onChange={choice => {
                if (choice === 'none') update({ date: '' });
                else if (choice !== 'other') update({ date: dayOffset(choice === 'today' ? 0 : choice === 'tomorrow' ? 1 : 7) });
              }}
              options={[
                { value: 'today' as const, label: 'Today' },
                { value: 'tomorrow' as const, label: 'Tomorrow' },
                { value: 'week' as const, label: 'Next week' },
                ...(draft.repeat.kind === 'NONE' ? [{ value: 'none' as const, label: 'No date' }] : []),
              ]} />
            <TaskScheduleField
              label="Date and time"
              value={scheduleOf(draft)}
              onChange={next => {
                const parsed = whenDraftFromSchedule(next, draft.reminderMinutesBefore, draft.repeat, draft.repeatSubtasks);
                update({ date: parsed.date, time: parsed.time });
              }} />
            {askScope && change.scheduleChanged && !!draft.date && (
              <ScopeChoice label="Apply the new date and time to" value={scheduleScope} onChange={setScheduleScope} />
            )}
            <TaskReminderField
              value={draft.reminderMinutesBefore}
              scheduledDateTime={scheduleOf(draft) || null}
              onChange={reminderMinutesBefore => update({ reminderMinutesBefore })} />
            {askScope && change.reminderChanged && (
              <ScopeChoice label="Apply the new reminder to" value={reminderScope} onChange={setReminderScope} />
            )}
          </View>
        ) : (
          <View style={styles.tabBody}>
            <RepeatEditor value={draft.repeat} startDate={draft.date} onChange={repeat => update({ repeat })}>
              {showRepeatSubtasks && (
                <View style={styles.switchRow}>
                  <AppText variant="label" style={styles.shrink}>Repeat subtasks with each occurrence</AppText>
                  <Switch value={draft.repeatSubtasks} onValueChange={repeatSubtasks => update({ repeatSubtasks })} />
                </View>
              )}
            </RepeatEditor>
            {askScope && change.repeatChanged && (
              <AppText variant="caption" color="muted">Repeat changes apply to every upcoming occurrence.</AppText>
            )}
          </View>
        )}
      </ModalSheet>
    </>
  );
}

function ScopeChoice({ label, value, onChange }: { label: string; value: ChangeScope; onChange: (value: ChangeScope) => void }) {
  return (
    <View style={styles.scope}>
      <AppText variant="caption" color="muted">{label}</AppText>
      <ChoiceChips value={value} onChange={onChange} options={SCOPES} fillSelected />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { height: 44, borderWidth: 1, borderRadius: 12, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  segment: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, height: '100%', borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: 'transparent' },
  growSegment: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1 },
  pressed: { opacity: 0.7 },
  tabs: { flexDirection: 'row', gap: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBody: { gap: 16, paddingTop: 14 },
  scope: { gap: 6 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
});
