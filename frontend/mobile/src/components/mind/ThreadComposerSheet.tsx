import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { reportError } from '@/lib/errors';
import { playAudioFeedback } from '@/lib/audioFeedback';
import { api } from '@/services/api';
import type { AttentionState, MentalThread } from '@/types/models';
import { AppButton } from '../ui/AppButton';
import { AppInput } from '../ui/AppInput';
import { AppSlider } from '../ui/AppSlider';
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
      onCreated(thread);
      playAudioFeedback('mentalThreadCreated');
      close();
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
      <View style={styles.loadSection}>
        <View style={styles.sectionHeading}>
          <AppText variant="label">Mental load</AppText>
          <AppText variant="label" color="accent">{load}/10</AppText>
        </View>
        <AppSlider
          label="Mental load"
          value={load}
          minimumValue={1}
          maximumValue={10}
          minimumLabel="Light"
          maximumLabel="Heavy"
          onValueChange={setLoad}
        />
      </View>
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  loadSection: { gap: 8 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
});
