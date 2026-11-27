import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { formatShortDate, localDate } from '@/lib/date';
import { useAppTheme } from '@/providers/ThemeProvider';
import { AppButton } from '../../ui/AppButton';
import { AppPopup } from '../../ui/AppPopup';
import { AppText } from '../../ui/AppText';
import { CalendarDatePicker } from '../../ui/CalendarDatePicker';
import { SilentPressable } from '../../ui/SilentPressable';

/** A `YYYY-MM-DD` value or none, picked from a month calendar. */
export function DateOnlyField({ label, emptyLabel, value, minDate, onChange }: {
  label: string;
  emptyLabel: string;
  value: string | null;
  minDate?: string;
  onChange: (value: string | null) => void;
}) {
  const { colors } = useAppTheme();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => new Date());

  function openPicker() {
    setDraft(new Date(`${value ?? minDate ?? localDate()}T12:00:00`));
    setOpen(true);
  }

  function choose() {
    const picked = localDate(draft);
    onChange(minDate && picked < minDate ? minDate : picked);
    setOpen(false);
  }

  return (
    <View style={styles.container}>
      <AppText variant="caption" color="muted">{label}</AppText>
      <SilentPressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ? formatShortDate(value) : emptyLabel}`}
        onPress={openPicker}
        style={[styles.field, { borderColor: colors.border, backgroundColor: colors.background }]}>
        <Ionicons name="calendar-outline" size={18} color={colors.accent} />
        <AppText variant="label" color={value ? 'default' : 'muted'} style={styles.value}>
          {value ? formatShortDate(value) : emptyLabel}
        </AppText>
      </SilentPressable>
      <AppPopup
        visible={open}
        showIcon={false}
        title={label}
        onClose={() => setOpen(false)}
        footer={(
          <View style={styles.actions}>
            <AppButton label={emptyLabel} variant="secondary" style={styles.action}
              onPress={() => { onChange(null); setOpen(false); }} />
            <AppButton label="Done" style={styles.action} onPress={choose} />
          </View>
        )}>
        <CalendarDatePicker value={draft} onChange={setDraft} />
      </AppPopup>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  field: { minHeight: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  value: { flex: 1 },
  actions: { flexDirection: 'row', gap: 10 },
  action: { flex: 1 },
});
