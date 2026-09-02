import { useState } from 'react';

import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { AppText } from '@/components/ui/AppText';
import { ModalSheet } from '@/components/ui/ModalSheet';
import { reportError } from '@/lib/errors';
import { useTaskWorkspace } from '@/providers/TaskWorkspaceProvider';

export function TaskGroupComposerSheet({ visible, taskIds, onClose, onCreated }: {
  visible: boolean;
  taskIds: string[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const { createGroup } = useTaskWorkspace();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    setName('');
    setError(null);
    onClose();
  }

  async function submit() {
    if (!name.trim()) {
      setError('Give the group a name.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createGroup(name.trim(), taskIds);
      onCreated();
      close();
    } catch (cause) {
      setError(reportError('Could not create group', cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalSheet
      visible={visible}
      onClose={close}
      title="Group tasks"
      footer={<AppButton label="Create group" icon="folder-open-outline" loading={saving} onPress={() => void submit()} />}>
      <AppText color="muted">Keep these {taskIds.length} tasks together in your workspace.</AppText>
      <AppInput autoFocus label="Group name" value={name} onChangeText={setName} error={error ?? undefined} />
    </ModalSheet>
  );
}
