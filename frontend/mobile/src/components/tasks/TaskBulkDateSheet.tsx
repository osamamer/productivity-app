import { useState } from 'react';
import { View } from 'react-native';

import { dateFromScheduleValue, TaskDateTimePicker } from './TaskScheduleField';
import { localDateTime } from '@/lib/date';
import { AppButton } from '@/components/ui/AppButton';
import { ModalSheet } from '@/components/ui/ModalSheet';

export function TaskBulkDateSheet({ visible, taskCount, initialValue, saving, onClose, onApply }: {
  visible: boolean;
  taskCount: number;
  initialValue: string | null;
  saving: boolean;
  onClose: () => void;
  onApply: (value: string) => void;
}) {
  const [draft, setDraft] = useState(() => dateFromScheduleValue(initialValue));

  return (
    <ModalSheet
      visible={visible}
      onClose={onClose}
      title={`Move ${taskCount} selected task${taskCount === 1 ? '' : 's'} to a date`}
      footer={(
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <AppButton style={{ flex: 1 }} variant="secondary" label="Cancel" onPress={onClose} disabled={saving} />
          <AppButton style={{ flex: 1 }} label="Move tasks" onPress={() => onApply(localDateTime(draft))} loading={saving} />
        </View>
      )}>
      <TaskDateTimePicker value={draft} onChange={setDraft} />
    </ModalSheet>
  );
}
