import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { reportError } from '@/lib/errors';
import { useAppTheme } from '@/providers/ThemeProvider';
import { api } from '@/services/api';
import type { StatDefinition, StatGroup } from '@/types/models';
import { AppButton } from '../ui/AppButton';
import { AppInput } from '../ui/AppInput';
import { AppText } from '../ui/AppText';
import { ModalSheet } from '../ui/ModalSheet';
import { SilentPressable } from '../ui/SilentPressable';

export function StatGroupComposerSheet({
  visible,
  group,
  definitions,
  onClose,
  onSaved,
}: {
  visible: boolean;
  group: StatGroup | null;
  definitions: StatDefinition[];
  onClose: () => void;
  onSaved: (group: StatGroup) => void;
}) {
  const { colors } = useAppTheme();
  const [name, setName] = useState(group?.name ?? '');
  const [selectedIds, setSelectedIds] = useState<string[]>(group?.statDefinitionIds ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    onClose();
  }

  function toggleDefinition(definitionId: string) {
    setSelectedIds(current => current.includes(definitionId)
      ? current.filter(id => id !== definitionId)
      : [...current, definitionId]);
  }

  async function submit() {
    if (!name.trim()) {
      setError('Give the group a name.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      let saved = group
        ? await api.stats.renameGroup(group.groupId, name.trim())
        : await api.stats.createGroup(name.trim(), selectedIds);
      if (group) {
        saved = await api.stats.replaceGroupDefinitions(group.groupId, selectedIds);
      }
      onSaved(saved);
      close();
    } catch (cause) {
      setError(reportError('Could not save stat group', cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalSheet
      visible={visible}
      onClose={close}
      title={group ? 'Edit stat group' : 'New stat group'}
      footer={<AppButton label={group ? 'Save group' : 'Create group'} loading={saving} onPress={() => void submit()} />}>
      <AppInput autoFocus label="Group name" value={name} onChangeText={setName} error={error ?? undefined} />
      <View style={styles.sectionHeading}>
        <AppText variant="label">Stats in this group</AppText>
        <AppText variant="caption" color="muted">{selectedIds.length} selected</AppText>
      </View>
      {definitions.length > 0 ? definitions.map(definition => {
        const selected = selectedIds.includes(definition.id);
        return (
          <SilentPressable
            key={definition.id}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={`${selected ? 'Remove' : 'Add'} ${definition.name} ${selected ? 'from' : 'to'} group`}
            onPress={() => toggleDefinition(definition.id)}
            style={({ pressed }) => [
              styles.definition,
              { backgroundColor: selected ? colors.accentSoft : colors.background, borderColor: selected ? colors.accent : colors.border },
              pressed && styles.pressed,
            ]}>
            <View style={[styles.checkbox, { borderColor: selected ? colors.accent : colors.border, backgroundColor: selected ? colors.accent : 'transparent' }]}>
              {selected && <Ionicons name="checkmark" size={16} color={colors.onAccent} />}
            </View>
            <AppText variant="label" numberOfLines={1} style={styles.definitionName}>{definition.name}</AppText>
          </SilentPressable>
        );
      }) : (
        <AppText color="muted">Create a stat first, then add it to this group.</AppText>
      )}
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  definition: { minHeight: 52, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 11 },
  checkbox: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  definitionName: { flex: 1 },
  pressed: { opacity: 0.72 },
});
