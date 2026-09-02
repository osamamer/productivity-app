import { useState } from 'react';

import { reportError } from '@/lib/errors';
import { api } from '@/services/api';
import type { StatDefinition, StatType } from '@/types/models';
import { AppButton } from '../ui/AppButton';
import { AppInput } from '../ui/AppInput';
import { AppText } from '../ui/AppText';
import { ChoiceChips } from '../ui/ChoiceChips';
import { ModalSheet } from '../ui/ModalSheet';

export function StatComposerSheet({ visible, onClose, onCreated }: {
  visible: boolean;
  onClose: () => void;
  onCreated: (definition: StatDefinition) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<StatType>('BOOLEAN');
  const [min, setMin] = useState('1');
  const [max, setMax] = useState('10');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  function reset() { setName(''); setDescription(''); setType('BOOLEAN'); setMin('1'); setMax('10'); setError(null); }
  function close() { reset(); onClose(); }

  async function submit() {
    if (!name.trim()) return setError('Give the stat a name.');
    const minValue = type === 'RANGE' ? Number(min) : undefined;
    const maxValue = type === 'RANGE' ? Number(max) : undefined;
    if (type === 'RANGE' && (!Number.isFinite(minValue) || !Number.isFinite(maxValue) || minValue! >= maxValue!)) return setError('Use a valid minimum below the maximum.');
    setSaving(true); setError(null);
    try {
      const definition = await api.stats.create({ name: name.trim(), description: description.trim(), type, minValue, maxValue });
      onCreated(definition); close();
    } catch (cause) { setError(reportError('Could not create stat', cause)); }
    finally { setSaving(false); }
  }

  return (
    <ModalSheet visible={visible} onClose={close} title="New stat" footer={<AppButton label="Create stat" loading={saving} onPress={() => void submit()} />}>
      <AppInput autoFocus label="Name" value={name} onChangeText={setName} error={error ?? undefined} />
      <AppInput label="Description (optional)" value={description} onChangeText={setDescription} multiline />
      <AppText variant="label">Type</AppText>
      <ChoiceChips value={type} onChange={setType} options={[{ value: 'BOOLEAN', label: 'Yes / No' }, { value: 'NUMBER', label: 'Number' }, { value: 'RANGE', label: 'Range' }]} />
      {type === 'RANGE' && <><AppInput label="Minimum" value={min} onChangeText={setMin} keyboardType="number-pad" /><AppInput label="Maximum" value={max} onChangeText={setMax} keyboardType="number-pad" /></>}
    </ModalSheet>
  );
}
