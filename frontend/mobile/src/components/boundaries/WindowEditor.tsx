import { StyleSheet, View } from 'react-native';

import { AppInput } from '@/components/ui/AppInput';
import { AppText } from '@/components/ui/AppText';
import { SilentPressable } from '@/components/ui/SilentPressable';
import { DAY_LETTERS } from '@/lib/boundaryRules';
import { useAppTheme } from '@/providers/ThemeProvider';

export interface WindowDraft {
  days: number[];
  start: string;
  end: string;
}

const NEW_WINDOW: WindowDraft = { days: [1, 2, 3, 4, 5], start: '09:00', end: '17:00' };

/** Time windows on chosen days, e.g. weekdays 09:00–17:00. */
export function WindowEditor({ windows, onChange }: { windows: WindowDraft[]; onChange: (windows: WindowDraft[]) => void }) {
  const { colors } = useAppTheme();
  const update = (index: number, patch: Partial<WindowDraft>) =>
    onChange(windows.map((window, other) => (other === index ? { ...window, ...patch } : window)));

  return (
    <View style={styles.wrapper}>
      {windows.map((window, index) => (
        <View key={index} style={[styles.card, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <View style={styles.days}>
            {DAY_LETTERS.map((letter, day) => {
              const on = window.days.includes(day);
              return (
                <SilentPressable
                  key={day}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => update(index, { days: on ? window.days.filter(other => other !== day) : [...window.days, day] })}
                  style={[styles.day, { backgroundColor: on ? colors.accent : 'transparent', borderColor: on ? colors.accent : colors.border }]}>
                  <AppText variant="label" style={{ color: on ? colors.onAccent : colors.textMuted }}>{letter}</AppText>
                </SilentPressable>
              );
            })}
          </View>
          <View style={styles.times}>
            <AppText color="muted">From</AppText>
            <AppInput value={window.start} onChangeText={start => update(index, { start })} placeholder="09:00" keyboardType="numbers-and-punctuation" maxLength={5} style={styles.time} />
            <AppText color="muted">to</AppText>
            <AppInput value={window.end} onChangeText={end => update(index, { end })} placeholder="17:00" keyboardType="numbers-and-punctuation" maxLength={5} style={styles.time} />
            <SilentPressable accessibilityRole="button" onPress={() => onChange(windows.filter((_, other) => other !== index))} style={styles.remove}>
              <AppText variant="caption" color="danger">Remove</AppText>
            </SilentPressable>
          </View>
        </View>
      ))}
      <SilentPressable accessibilityRole="button" onPress={() => onChange([...windows, NEW_WINDOW])} style={styles.add}>
        <AppText variant="label" color="accent">+ Add time window</AppText>
      </SilentPressable>
      <AppText variant="caption" color="muted">
        24-hour time. An end earlier than the start runs past midnight (22:00 to 06:00). The same start and end means all day.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 10 },
  card: { borderRadius: 16, borderWidth: 1, padding: 12, gap: 12 },
  days: { flexDirection: 'row', justifyContent: 'space-between' },
  day: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  times: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  time: { width: 76, minHeight: 40, paddingVertical: 6, textAlign: 'center' },
  remove: { marginLeft: 'auto', padding: 4 },
  add: { paddingVertical: 8, alignItems: 'center' },
});
