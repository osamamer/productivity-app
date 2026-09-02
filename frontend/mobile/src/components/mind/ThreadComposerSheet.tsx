import { useState } from 'react';

import { reportError } from '@/lib/errors';
import { api } from '@/services/api';
import type { AttentionState, MentalThread } from '@/types/models';
import { AppButton } from '../ui/AppButton';
import { AppInput } from '../ui/AppInput';
import { AppText } from '../ui/AppText';
import { ChoiceChips } from '../ui/ChoiceChips';
import { ModalSheet } from '../ui/ModalSheet';

export function ThreadComposerSheet({ visible, onClose, onCreated }: {
  visible: boolean;
  onClose: () => void;
  onCreated: (thread: MentalThread) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [desiredResolution, setDesiredResolution] = useState('');
  const [attentionState, setAttentionState] = useState<AttentionState>('PENDING');
  const [load, setLoad] = useState(5);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setTitle(''); setDescription(''); setDesiredResolution(''); setAttentionState('PENDING'); setLoad(5); setError(null);
  }

  function close() { reset(); onClose(); }

  async function submit() {
    if (!title.trim()) return setError('Name what is taking up space.');
    setSaving(true); setError(null);
    try {
      const thread = await api.mentalThreads.create({
        title: title.trim(), description: description.trim() || null, attentionState,
        desiredResolution: desiredResolution.trim() || null, targetCloseDate: null,
        hardDeadlineDate: null, nextReviewDate: null, currentMentalLoad: load, loadReason: null,
      });
      onCreated(thread); close();
    } catch (cause) {
      setError(reportError('Could not create thread', cause));
    } finally { setSaving(false); }
  }

  return (
    <ModalSheet visible={visible} onClose={close} title="New mental thread" footer={<AppButton label="Capture thread" loading={saving} onPress={() => void submit()} />}>
      <AppInput autoFocus label="What keeps returning?" value={title} onChangeText={setTitle} error={error ?? undefined} />
      <AppInput label="What is happening? (optional)" multiline value={description} onChangeText={setDescription} />
      <AppInput label="What would ‘handled’ look like?" multiline value={desiredResolution} onChangeText={setDesiredResolution} />
      <AppText variant="label">Attention state</AppText>
      <ChoiceChips value={attentionState} onChange={setAttentionState} options={[
        { value: 'ACTING', label: 'Acting' }, { value: 'RUMINATING', label: 'Ruminating' },
        { value: 'PLANNED', label: 'Planned' }, { value: 'PENDING', label: 'Pending' },
      ]} />
      <AppText variant="label">Mental load · {load}/10</AppText>
      <ChoiceChips value={load} onChange={setLoad} options={[1,2,3,4,5,6,7,8,9,10].map(value => ({ value, label: String(value) }))} />
    </ModalSheet>
  );
}
