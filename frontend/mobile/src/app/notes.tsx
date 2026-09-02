import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { ModalSheet } from '@/components/ui/ModalSheet';
import { Screen } from '@/components/ui/Screen';
import { EmptyView, ErrorView, LoadingView } from '@/components/ui/StateView';
import { useAsyncData } from '@/hooks/useAsyncData';
import { reportError } from '@/lib/errors';
import { useAppPopup } from '@/providers/PopupProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { api } from '@/services/api';
import type { Note } from '@/types/models';

function plainText(content: string): string {
  return content
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim();
}

export default function NotesScreen() {
  const { colors } = useAppTheme();
  const { confirm, showError } = useAppPopup();
  const resource = useAsyncData(() => api.notes.all());
  const [selected, setSelected] = useState<Note | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const notes = useMemo(() => [...(resource.data ?? [])].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt)), [resource.data]);

  function openNote(note: Note) {
    setSelected(note);
    setTitle(note.title);
    setContent(plainText(note.content));
    setError(null);
  }

  async function create() {
    setSaving(true);
    try {
      const note = await api.notes.create();
      resource.setData(current => current ? [note, ...current] : [note]);
      openNote(note);
    } catch (cause) { void showError('Could not create note', reportError('Could not create note', cause)); }
    finally { setSaving(false); }
  }

  async function save() {
    if (!selected) return;
    setSaving(true); setError(null);
    try {
      const updated = await api.notes.update(selected.id, { title: title.trim() || 'Untitled', content });
      resource.setData(current => current?.map(note => note.id === updated.id ? updated : note) ?? current);
      setSelected(null);
    } catch (cause) { setError(reportError('Could not save note', cause)); }
    finally { setSaving(false); }
  }

  async function togglePinned(note: Note) {
    try {
      const updated = await api.notes.update(note.id, { pinned: !note.pinned });
      resource.setData(current => current?.map(item => item.id === updated.id ? updated : item) ?? current);
      setSelected(updated);
    } catch (cause) { setError(reportError('Could not update note', cause)); }
  }

  async function remove(note: Note) {
    if (!await confirm('Delete note?', note.title, 'Delete')) return;
    try {
      await api.notes.remove(note.id);
      resource.setData(current => current?.filter(item => item.id !== note.id) ?? current);
      setSelected(null);
    } catch (cause) {
      setError(reportError('Could not delete note', cause));
    }
  }

  return (
    <Screen title="Notes" eyebrow="Keep what matters" action={<AppButton compact label="New" icon="add" loading={saving} onPress={() => void create()} />} refreshing={resource.refreshing} onRefresh={() => void resource.reload()}>
      {resource.loading && <LoadingView label="Loading notes…" />}
      {resource.error && !resource.data && <ErrorView message={resource.error} retry={() => void resource.reload()} />}
      {!resource.loading && resource.data && !notes.length && <EmptyView title="A quiet notebook" message="Create a note when you want to keep a thought close." />}
      <View style={styles.grid}>
        {notes.map(note => (
          <Pressable key={note.id} onPress={() => openNote(note)} style={styles.half}>
            <Card style={styles.note}>
              <View style={styles.spaceBetween}><AppText variant="heading" numberOfLines={2} style={styles.grow}>{note.title || 'Untitled'}</AppText>{note.pinned && <Ionicons name="pin" size={16} color={colors.accent} />}</View>
              <AppText color="muted" numberOfLines={5}>{plainText(note.content) || 'Empty note'}</AppText>
              <AppText variant="caption" color="muted">{new Date(note.updatedAt).toLocaleDateString()}</AppText>
            </Card>
          </Pressable>
        ))}
      </View>
      <ModalSheet visible={Boolean(selected)} onClose={() => setSelected(null)} title="Edit note" footer={<AppButton label="Save note" loading={saving} onPress={() => void save()} />}>
        <AppInput label="Title" value={title} onChangeText={setTitle} />
        <AppInput label="Note" multiline value={content} onChangeText={setContent} style={styles.editor} />
        {selected?.content.includes('<') && <AppText variant="caption" color="muted">Rich web formatting is shown as plain text on mobile and will be simplified when saved.</AppText>}
        {error && <AppText color="danger">{error}</AppText>}
        {selected && <View style={styles.actions}><AppButton style={styles.grow} variant="secondary" label={selected.pinned ? 'Unpin' : 'Pin'} icon="pin-outline" onPress={() => void togglePinned(selected)} /><AppButton style={styles.grow} variant="danger" label="Delete" icon="trash-outline" onPress={() => remove(selected)} /></View>}
      </ModalSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 }, half: { width: '50%', paddingHorizontal: 5, marginBottom: 10 }, note: { minHeight: 190, gap: 10, padding: 14 },
  grow: { flex: 1 }, spaceBetween: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 }, editor: { minHeight: 280 },
  actions: { flexDirection: 'row', gap: 10 },
});
