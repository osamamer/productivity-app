import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { formatTimeValue } from '@/lib/statValues';
import { booleanStatColor } from '@/lib/statMorality';
import { useAppTheme } from '@/providers/ThemeProvider';
import type { StatDefinition, StatType } from '@/types/models';
import { AppButton } from '../ui/AppButton';
import { AppInput } from '../ui/AppInput';
import { AppPopup } from '../ui/AppPopup';
import { AppText } from '../ui/AppText';
import { ChoiceChips } from '../ui/ChoiceChips';
import { DurationInput } from './DurationInput';
import { TimePicker } from '../tasks/TaskScheduleField';

function dateForMinutes(value: number): Date {
  const date = new Date();
  date.setHours(Math.floor(value / 60), value % 60, 0, 0);
  return date;
}

function labelForType(type: StatType): string {
  switch (type) {
    case 'BOOLEAN': return 'Yes or no';
    case 'RANGE': return 'Rating';
    case 'DURATION': return 'Duration';
    case 'TIME': return 'Time';
    case 'NUMBER': return 'Amount';
  }
}

export function StatAdditionalInputControl({ definition, type, value, onChange }: {
  definition: StatDefinition;
  type: StatType;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  const { colors } = useAppTheme();
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [timeValue, setTimeValue] = useState(() => dateForMinutes(value ?? 12 * 60));
  const [numberText, setNumberText] = useState(value == null ? '' : String(value));
  const lastEmittedValue = useRef<number | null>(value);

  useEffect(() => {
    if (value === lastEmittedValue.current) return;
    lastEmittedValue.current = value;
    setNumberText(value == null ? '' : String(value));
    setTimeValue(dateForMinutes(value ?? 12 * 60));
  }, [value]);

  return (
    <View style={{ gap: 8 }}>
      <AppText variant="caption" color="muted">{labelForType(type)}</AppText>
      {type === 'BOOLEAN' ? (
        <ChoiceChips
          value={value == null ? -1 : value}
          onChange={next => onChange(next === -1 ? null : next)}
          options={[
            { value: -1, label: '—' },
            { value: 1, label: 'Yes', color: booleanStatColor(definition, 1, colors) },
            { value: 0, label: 'No', color: booleanStatColor(definition, 0, colors) },
          ]}
        />
      ) : type === 'RANGE' ? (
        <ChoiceChips
          value={value ?? -1}
          onChange={next => onChange(next === -1 ? null : next)}
          options={[
            { value: -1, label: '—' },
            ...Array.from({ length: 11 }, (_, index) => ({ value: index, label: String(index) })),
          ]}
        />
      ) : type === 'DURATION' ? (
        <DurationInput value={value} onChange={onChange} />
      ) : type === 'TIME' ? (
        <>
          <AppButton
            variant="secondary"
            label={value == null ? 'Choose time' : formatTimeValue(value)}
            icon="time-outline"
            onPress={() => setTimePickerOpen(true)}
          />
          <AppPopup
            visible={timePickerOpen}
            title="Choose time"
            showIcon={false}
            onClose={() => setTimePickerOpen(false)}
            dismissOnBackdrop={false}
            scrollContent
            footer={<AppButton label="Done" onPress={() => setTimePickerOpen(false)} />}
          >
            <TimePicker
              value={timeValue}
              onChange={next => {
                const nextValue = next.getHours() * 60 + next.getMinutes();
                setTimeValue(next);
                lastEmittedValue.current = nextValue;
                onChange(nextValue);
              }}
            />
          </AppPopup>
        </>
      ) : (
        <AppInput
          label={definition.unit ? `Amount (${definition.unit})` : 'Amount'}
          value={numberText}
          onChangeText={next => {
            setNumberText(next);
            const parsed = next.trim() === '' ? null : Number(next);
            const nextValue = parsed === null || Number.isFinite(parsed) ? parsed : null;
            lastEmittedValue.current = nextValue;
            onChange(nextValue);
          }}
          keyboardType="decimal-pad"
        />
      )}
    </View>
  );
}
