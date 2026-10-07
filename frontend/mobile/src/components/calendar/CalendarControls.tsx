import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import type { Calendar, CalendarColor, CalendarInput } from '@/types/models';
import { AppButton } from '../ui/AppButton';
import { AppInput } from '../ui/AppInput';
import { AppPopup } from '../ui/AppPopup';
import { AppText } from '../ui/AppText';
import { ModalSheet } from '../ui/ModalSheet';
import { useAppTheme } from '@/providers/ThemeProvider';
import { SilentPressable } from '../ui/SilentPressable';

export const CALENDAR_COLORS: { value: CalendarColor; label: string; hex: string }[] = [
  { value: 'accent', label: 'Accent', hex: '#9584d6' },
  { value: 'blue', label: 'Blue', hex: '#a9c9e8' },
  { value: 'purple', label: 'Purple', hex: '#c0afe8' },
  { value: 'green', label: 'Green', hex: '#a9d2ba' },
  { value: 'orange', label: 'Orange', hex: '#efc29e' },
  { value: 'red', label: 'Red', hex: '#e3a8a8' },
  { value: 'teal', label: 'Teal', hex: '#9dcfca' },
  { value: 'pink', label: 'Pink', hex: '#e3b0c7' },
  { value: 'indigo', label: 'Indigo', hex: '#acb9e2' },
] as const;

export function calendarColorHex(color: string | null | undefined, accentColor = CALENDAR_COLORS[0].hex): string {
  if (color === 'accent') return accentColor;
  return CALENDAR_COLORS.find(option => option.value === color)?.hex ?? accentColor;
}

export function calendarTextColor(hex: string): string {
  const normalized = hex.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return '#FFFFFF';
  const channels = [0, 2, 4].map(offset => parseInt(normalized.slice(offset, offset + 2), 16) / 255);
  const linear = channels.map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  const luminance = linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  const whiteContrast = 1.05 / (luminance + 0.05);
  const darkContrast = (luminance + 0.05) / (0.014 + 0.05);
  return darkContrast > whiteContrast ? '#18202A' : '#FFFFFF';
}

export function CalendarDestinationField({
  calendars,
  value,
  onChange,
}: {
  calendars: Calendar[];
  value: string;
  onChange: (calendarId: string) => void;
}) {
  const { colors } = useAppTheme();
  const [open, setOpen] = useState(false);
  if (!calendars.length) return null;
  const selected = calendars.find(calendar => calendar.id === value);
  if (calendars.length < 2) return null;
  const selectionColor = (calendar: Calendar) => calendarColorHex(calendar.color, colors.accent);

  return (
    <View style={styles.destinationField}>
      <AppText variant="label">Calendar</AppText>
      <SilentPressable
        accessibilityRole="button"
        accessibilityLabel={`Calendar: ${selected?.name ?? 'Default'}`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.destinationButton, { borderColor: colors.border, backgroundColor: colors.background }, pressed && styles.pressed]}>
        <View style={[styles.swatch, { backgroundColor: selected ? selectionColor(selected) : colors.accent }]} />
        <AppText variant="label" style={styles.destinationName}>{selected?.name ?? 'Default'}</AppText>
        <Ionicons name="chevron-down" size={17} color={colors.textMuted} />
      </SilentPressable>
      <AppPopup
        visible={open}
        showIcon={false}
        title="Choose a calendar"
        onClose={() => setOpen(false)}
        footer={<AppButton label="Done" onPress={() => setOpen(false)} />}>
        <View style={styles.destinationOptions}>
          {calendars.map(calendar => {
            const isSelected = calendar.id === value;
            return (
              <SilentPressable
                key={calendar.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: isSelected }}
                onPress={() => { onChange(calendar.id); setOpen(false); }}
                style={({ pressed }) => [styles.destinationOption, { borderColor: isSelected ? selectionColor(calendar) : colors.border, backgroundColor: isSelected ? `${selectionColor(calendar)}16` : colors.background }, pressed && styles.pressed]}>
                <View style={[styles.swatch, { backgroundColor: selectionColor(calendar) }]} />
                <AppText variant="label" style={styles.destinationName}>{calendar.name}</AppText>
                {isSelected && <Ionicons name="checkmark-circle" size={20} color={selectionColor(calendar)} />}
              </SilentPressable>
            );
          })}
        </View>
      </AppPopup>
    </View>
  );
}

export function CalendarManagementContent({
  calendars,
  loading,
  onVisibilityChange,
  onAdd,
  onEdit,
}: {
  calendars: Calendar[];
  loading: boolean;
  onVisibilityChange: (calendar: Calendar, visible: boolean) => Promise<void>;
  onAdd: () => void;
  onEdit: (calendar: Calendar) => void;
}) {
  const { colors } = useAppTheme();
  const [error, setError] = useState<string | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);

  async function toggleVisibility(calendar: Calendar, visible: boolean) {
    setWorkingId(calendar.id);
    setError(null);
    try {
      await onVisibilityChange(calendar, visible);
    } catch {
      setError('Could not update calendar visibility. Try again.');
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <>
      <View style={styles.managementHeading}>
        <AppText variant="label">Calendars</AppText>
        <AppButton compact icon="add" label="Add calendar" onPress={onAdd} />
      </View>
      {loading ? <AppText variant="caption" color="muted">Loading calendars…</AppText> : (
        <View style={styles.calendarList}>
          {calendars.map(calendar => (
            <View key={calendar.id} style={[styles.calendarRow, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <View style={[styles.swatch, styles.rowSwatch, { backgroundColor: calendarColorHex(calendar.color, colors.accent) }]} />
              <View style={styles.calendarCopy}>
                <AppText variant="label" numberOfLines={1}>{calendar.name}</AppText>
              </View>
              <Switch
                accessibilityLabel={`Show ${calendar.name} in calendar`}
                value={calendar.visible}
                disabled={workingId === calendar.id}
                onValueChange={visible => void toggleVisibility(calendar, visible)}
                trackColor={{ false: colors.border, true: colors.accentSoft }}
                thumbColor={calendar.visible ? calendarColorHex(calendar.color, colors.accent) : colors.textMuted} />
              <SilentPressable accessibilityRole="button" accessibilityLabel={`Edit ${calendar.name}`} onPress={() => onEdit(calendar)} style={styles.iconButton}>
                <Ionicons name="pencil-outline" size={18} color={colors.textMuted} />
              </SilentPressable>
            </View>
          ))}
          {!calendars.length && <AppText variant="caption" color="muted">No calendars are available.</AppText>}
        </View>
      )}
      {error && <AppText variant="caption" color="danger">{error}</AppText>}
    </>
  );
}

export function CalendarComposerSheet({ calendar, visible, onClose, onSave, onDelete }: {
  calendar: Calendar | null;
  visible: boolean;
  onClose: () => void;
  onSave: (input: CalendarInput) => Promise<void>;
  onDelete?: (calendar: Calendar) => Promise<void>;
}) {
  const { colors } = useAppTheme();
  const [name, setName] = useState(calendar?.name ?? '');
  const [color, setColor] = useState<CalendarColor>(calendar?.color ?? 'accent');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim()) {
      setError('Give the calendar a name.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({ name: name.trim(), color });
    } catch {
      setError('Could not save this calendar. Try again.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteCalendar() {
    if (!calendar || !onDelete) return;
    setSaving(true);
    setError(null);
    try {
      await onDelete(calendar);
      onClose();
    } catch {
      setError('Could not delete this calendar. Try again.');
      setConfirmDelete(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalSheet
      visible={visible}
      onClose={onClose}
      title={calendar ? 'Edit calendar' : 'New calendar'}
      footer={<AppButton label={calendar ? 'Save calendar' : 'Create calendar'} loading={saving} onPress={() => void submit()} />}>
      <AppInput label="Name" value={name} onChangeText={value => { setName(value); setError(null); }} maxLength={60} error={error ?? undefined} />
      <AppText variant="label">Color</AppText>
      <View style={styles.colorChoices}>
        {CALENDAR_COLORS.map(option => {
          const selected = option.value === color;
          const optionColor = option.value === 'accent' ? colors.accent : option.hex;
          return (
            <SilentPressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityLabel={`Calendar color ${option.label}`}
              accessibilityState={{ checked: selected }}
              onPress={() => setColor(option.value)}
              style={[styles.colorChoice, { borderColor: selected ? colors.text : colors.border }]}>
              <View style={[styles.colorSwatch, { backgroundColor: optionColor }]}>
                {selected && <Ionicons name="checkmark" size={15} color={calendarTextColor(optionColor)} />}
              </View>
              <AppText variant="caption">{option.label}</AppText>
            </SilentPressable>
          );
        })}
      </View>
      {calendar && !calendar.isDefault && onDelete && (
        confirmDelete ? (
          <View style={styles.deleteCalendarPrompt}>
            <AppText variant="caption" color="muted">Its tasks and events stay in the app, but disappear from calendar views.</AppText>
            <View style={styles.popupActions}>
              <AppButton style={styles.popupAction} label="Keep calendar" variant="secondary" disabled={saving} onPress={() => setConfirmDelete(false)} />
              <AppButton style={styles.popupAction} label="Delete" variant="danger" loading={saving} disabled={saving} onPress={() => void deleteCalendar()} />
            </View>
          </View>
        ) : (
          <AppButton compact label="Delete calendar" variant="ghost" onPress={() => setConfirmDelete(true)} />
        )
      )}
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  destinationField: { gap: 8 },
  destinationButton: { minHeight: 48, borderWidth: 1, borderRadius: 14, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
  destinationName: { flex: 1 },
  destinationOptions: { gap: 8 },
  destinationOption: { minHeight: 48, borderWidth: 1, borderRadius: 13, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 9 },
  swatch: { width: 16, height: 16, borderRadius: 8 },
  managementHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  calendarList: { gap: 7 },
  calendarRow: { minHeight: 55, borderWidth: 1, borderRadius: 13, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowSwatch: { width: 12, height: 12 },
  calendarCopy: { flex: 1, minWidth: 60, gap: 2 },
  iconButton: { width: 30, height: 40, alignItems: 'center', justifyContent: 'center' },
  colorChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  colorChoice: { width: 58, minHeight: 52, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  colorSwatch: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  popupActions: { flexDirection: 'row', gap: 10 },
  popupAction: { flex: 1 },
  deleteCalendarPrompt: { gap: 10 },
  pressed: { opacity: 0.72 },
});
