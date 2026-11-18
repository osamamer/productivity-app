import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { AppInput } from '@/components/ui/AppInput';
import { AppText } from '@/components/ui/AppText';
import { ChoiceChips } from '@/components/ui/ChoiceChips';
import { DEFAULT_DELAY_MESSAGE, formatDelay } from '@/lib/boundaryRules';
import { useAppTheme } from '@/providers/ThemeProvider';

const PRESETS = [0, 10, 30, 60, 120, 300];
const CUSTOM = -1;

export interface DelayDraft {
  /** Seconds as typed; blank = off. */
  seconds: string;
  autoOpen: boolean;
  message: string;
}

interface Props {
  appName: string;
  draft: DelayDraft;
  onChange: (draft: DelayDraft) => void;
}

/** "Pause before opening": the countdown shown over the app before each unlock. */
export function DelayEditor({ appName, draft, onChange }: Props) {
  const { colors } = useAppTheme();
  const seconds = Number(draft.seconds) || 0;
  const [custom, setCustom] = useState(!PRESETS.includes(seconds));
  const preset = custom ? CUSTOM : seconds;
  const set = (patch: Partial<DelayDraft>) => onChange({ ...draft, ...patch });
  const choose = (value: number) => {
    setCustom(value === CUSTOM);
    if (value !== CUSTOM) set({ seconds: value ? String(value) : '' });
  };

  return (
    <View style={styles.body}>
      <ChoiceChips<number>
        value={preset}
        onChange={choose}
        fillSelected
        options={[
          ...PRESETS.map(value => ({ value, label: value ? formatDelay(value) : 'Off' })),
          { value: CUSTOM, label: 'Custom' },
        ]}
      />

      {custom && (
        <View style={styles.row}>
          <AppText variant="label" style={styles.grow}>Seconds to wait</AppText>
          <AppInput
            value={draft.seconds}
            onChangeText={text => set({ seconds: text.replace(/[^0-9]/g, '') })}
            placeholder="off"
            keyboardType="number-pad"
            maxLength={4}
            style={styles.input}
          />
          <AppText variant="caption" color="muted" style={styles.unit}>s</AppText>
        </View>
      )}

      {seconds > 0 && (
        <>
          <AppInput
            value={draft.message}
            onChangeText={message => set({ message })}
            placeholder={DEFAULT_DELAY_MESSAGE}
            maxLength={300}
          />
          <View style={styles.row}>
            <View style={styles.grow}>
              <AppText variant="label">Open automatically</AppText>
              <AppText variant="caption" color="muted">Off: you still choose to open {appName} after the countdown.</AppText>
            </View>
            <Switch
              value={draft.autoOpen}
              onValueChange={autoOpen => set({ autoOpen })}
              trackColor={{ true: colors.accent, false: colors.border }}
              thumbColor={colors.surface}
            />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  grow: { flex: 1, gap: 2 },
  input: { width: 72, minHeight: 42, paddingVertical: 8, textAlign: 'center' },
  unit: { width: 24 },
});
