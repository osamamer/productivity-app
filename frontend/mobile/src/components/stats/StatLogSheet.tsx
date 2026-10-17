import { Ionicons } from '@expo/vector-icons';
import { useMemo, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { formatShortDate, localDate } from '@/lib/date';
import { useAppTheme } from '@/providers/ThemeProvider';
import type { StatDefinition } from '@/types/models';
import { AppButton } from '../ui/AppButton';
import { AppInput } from '../ui/AppInput';
import { AppPopup } from '../ui/AppPopup';
import { AppText } from '../ui/AppText';
import { CalendarDatePicker } from '../ui/CalendarDatePicker';
import { ChoiceChips } from '../ui/ChoiceChips';
import { ModalSheet } from '../ui/ModalSheet';
import { SilentPressable } from '../ui/SilentPressable';

type DateChoice = 'today' | 'yesterday' | 'custom';

function yesterdayDate(): string {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return localDate(date);
}

export function StatLogSheet({ visible, definitions, onClose, onSelect }: {
  visible: boolean;
  definitions: StatDefinition[];
  onClose: () => void;
  onSelect: (definition: StatDefinition, date: string) => void;
}) {
  const { colors } = useAppTheme();
  const searchInputRef = useRef<TextInput>(null);
  const [query, setQuery] = useState('');
  const [dateChoice, setDateChoice] = useState<DateChoice>('today');
  const [entryDate, setEntryDate] = useState(localDate());
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  function prepareForDisplay() {
    setQuery('');
    setDateChoice('today');
    setEntryDate(localDate());
    setDatePickerOpen(false);
    searchInputRef.current?.focus();
  }

  const filteredDefinitions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return definitions;
    return definitions.filter(definition => definition.name.toLocaleLowerCase().includes(normalizedQuery));
  }, [definitions, query]);

  function chooseDate(choice: DateChoice) {
    setDateChoice(choice);
    if (choice === 'today') setEntryDate(localDate());
    if (choice === 'yesterday') setEntryDate(yesterdayDate());
    if (choice === 'custom') {
      searchInputRef.current?.blur();
      setDatePickerOpen(true);
    }
  }

  return (
    <ModalSheet
      visible={visible}
      onClose={onClose}
      onShow={prepareForDisplay}
      title="Log a stat">
      <View style={styles.section}>
        <AppText variant="label">Date</AppText>
        <ChoiceChips
          value={dateChoice}
          onChange={chooseDate}
          options={[
            { value: 'today' as const, label: 'Today' },
            { value: 'yesterday' as const, label: 'Yesterday' },
            { value: 'custom' as const, label: 'Custom' },
          ]}
        />
        {dateChoice === 'custom' && <AppText variant="caption" color="muted">{formatShortDate(entryDate)}</AppText>}
      </View>
      <AppInput
        ref={searchInputRef}
        label="Find a stat"
        placeholder="Search by name"
        value={query}
        onChangeText={setQuery}
        returnKeyType="search"
        accessibilityLabel="Search stats to log"
      />
      <View style={styles.results}>
        {filteredDefinitions.length === 0 ? (
          <AppText color="muted">{definitions.length ? 'No matching stats.' : 'Create a stat before logging one.'}</AppText>
        ) : filteredDefinitions.map(definition => (
          <SilentPressable
            key={definition.id}
            accessibilityRole="button"
            accessibilityLabel={`Log ${definition.name}`}
            onPress={() => onSelect(definition, entryDate)}
            style={({ pressed }) => [
              styles.result,
              { borderColor: colors.border, backgroundColor: colors.background },
              pressed && styles.pressed,
            ]}>
            <View style={[styles.resultIcon, { backgroundColor: colors.accentSoft }]}>
              <Ionicons name="stats-chart-outline" size={18} color={colors.accent} />
            </View>
            <View style={styles.resultCopy}>
              <AppText variant="label" numberOfLines={1}>{definition.name}</AppText>
            </View>
            <Ionicons name="chevron-forward" size={17} color={colors.textMuted} />
          </SilentPressable>
        ))}
      </View>
      <AppPopup
        visible={datePickerOpen}
        title="Choose date"
        showIcon={false}
        onClose={() => setDatePickerOpen(false)}
        dismissOnBackdrop={false}
        footer={<AppButton label="Done" onPress={() => setDatePickerOpen(false)} />}>
        <CalendarDatePicker
          key={entryDate}
          value={new Date(`${entryDate}T12:00:00`)}
          onChange={date => setEntryDate(localDate(date))}
        />
      </AppPopup>
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  results: { gap: 8 },
  result: { minHeight: 56, borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  resultIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  resultCopy: { flex: 1, gap: 2 },
  pressed: { opacity: 0.72 },
});
