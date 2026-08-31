import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api } from '@/services/api';
import type { AttentionState, ClosureType, MentalThread } from '@/types/models';
import { AppButton } from '../ui/AppButton';
import { AppInput } from '../ui/AppInput';
import { AppText } from '../ui/AppText';
import { ChoiceChips } from '../ui/ChoiceChips';
import { ModalSheet } from '../ui/ModalSheet';

export function ThreadDetailSheet({ thread, onClose, onUpdated }: {
  thread: MentalThread | null;
  onClose: () => void;
  onUpdated: (thread: MentalThread) => void;
}) {
  const [title, setTitle] = useState(thread?.title ?? '');
  const [description, setDescription] = useState(thread?.description ?? '');
  const [desired, setDesired] = useState(thread?.desiredResolution ?? '');
  const [attention, setAttention] = useState<AttentionState>(thread?.attentionState ?? 'PENDING');
  const [load, setLoad] = useState(thread?.currentMentalLoad ?? 5);
  const [closure, setClosure] = useState<ClosureType>(thread?.closureType ?? 'RESOLVED');
  const [resolution, setResolution] = useState(thread?.resolutionSummary ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!thread || !title.trim()) return;
    setSaving(true); setError(null);
    try {
      const updated = await api.mentalThreads.update(thread.id, {
        title: title.trim(), description: description.trim() || null, attentionState: attention,
        desiredResolution: desired.trim() || null, targetCloseDate: thread.targetCloseDate,
        hardDeadlineDate: thread.hardDeadlineDate, nextReviewDate: thread.nextReviewDate,
        currentMentalLoad: load, loadReason: null,
      });
      onUpdated(updated); onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save this thread.'); }
    finally { setSaving(false); }
  }

  async function changeClosedState() {
    if (!thread) return;
    if (thread.status === 'OPEN' && !resolution.trim()) return setError('Add a short closure note first.');
    setSaving(true); setError(null);
    try {
      const updated = thread.status === 'OPEN'
        ? await api.mentalThreads.close(thread.id, closure, resolution.trim())
        : await api.mentalThreads.reopen(thread.id);
      onUpdated(updated); onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update this thread.'); }
    finally { setSaving(false); }
  }

  return (
    <ModalSheet visible={Boolean(thread)} onClose={onClose} title={thread?.status === 'CLOSED' ? 'Closed thread' : 'Mental thread'} footer={<AppButton label="Save changes" loading={saving} onPress={() => void save()} />}>
      <AppInput label="Thread" value={title} onChangeText={setTitle} />
      <AppInput label="Details" multiline value={description} onChangeText={setDescription} />
      <AppInput label="Desired resolution" multiline value={desired} onChangeText={setDesired} />
      <AppText variant="label">Attention state</AppText>
      <ChoiceChips value={attention} onChange={setAttention} options={[
        { value: 'ACTING', label: 'Acting' }, { value: 'RUMINATING', label: 'Ruminating' },
        { value: 'PLANNED', label: 'Planned' }, { value: 'PENDING', label: 'Pending' },
      ]} />
      <AppText variant="label">Mental load · {load}/10</AppText>
      <ChoiceChips value={load} onChange={setLoad} options={[1,2,3,4,5,6,7,8,9,10].map(value => ({ value, label: String(value) }))} />
      {thread?.status === 'OPEN' && (
        <View style={styles.closure}>
          <AppText variant="heading">Close the loop</AppText>
          <ChoiceChips value={closure} onChange={setClosure} options={[
            { value: 'RESOLVED', label: 'Resolved' }, { value: 'ACCEPTED', label: 'Accepted' }, { value: 'RELEASED', label: 'Released' },
          ]} />
          <AppInput label="What changed?" multiline value={resolution} onChangeText={setResolution} />
        </View>
      )}
      {error && <AppText color="danger">{error}</AppText>}
      <AppButton
        variant="secondary"
        label={thread?.status === 'OPEN' ? 'Close thread' : 'Reopen thread'}
        icon={thread?.status === 'OPEN' ? 'checkmark-circle-outline' : 'refresh-outline'}
        loading={saving}
        onPress={() => void changeClosedState()}
      />
    </ModalSheet>
  );
}

const styles = StyleSheet.create({ closure: { gap: 12, paddingTop: 8 } });
