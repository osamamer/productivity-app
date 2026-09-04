import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { SilentPressable } from '@/components/ui/SilentPressable';
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
  const { showError } = useAppPopup();
  const resource = useAsyncData(() => api.notes.all());
  const { reload } = resource;
  const [creating, setCreating] = useState(false);
  const hasFocusedRef = useRef(false);

  useFocusEffect(useCallback(() => {
    if (hasFocusedRef.current) void reload();
    hasFocusedRef.current = true;
  }, [reload]));

  const notes = useMemo(() => [...(resource.data ?? [])].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt)), [resource.data]);

  function openNote(note: Note) {
    router.push(`/notes/${note.id}`);
  }

  async function create() {
    setCreating(true);
    try {
      const note = await api.notes.create();
      resource.setData(current => current ? [note, ...current] : [note]);
      router.push(`/notes/${note.id}`);
    } catch (cause) { void showError('Could not create note', reportError('Could not create note', cause)); }
    finally { setCreating(false); }
  }

  return (
    <Screen title="Notes" eyebrow="Keep what matters" action={<AppButton compact label="New" icon="add" loading={creating} onPress={() => void create()} />} refreshing={resource.refreshing} onRefresh={() => void resource.reload()}>
      {resource.loading && <LoadingView label="Loading notes…" />}
      {resource.error && !resource.data && <ErrorView message={resource.error} retry={() => void resource.reload()} />}
      {!resource.loading && resource.data && !notes.length && <EmptyView title="A quiet notebook" message="Create a note when you want to keep a thought close." />}
      <View style={styles.grid}>
        {notes.map(note => (
          <SilentPressable key={note.id} onPress={() => openNote(note)} style={styles.half}>
            <Card style={styles.note}>
              <View style={styles.spaceBetween}><AppText variant="heading" numberOfLines={2} style={styles.grow}>{note.title || 'Untitled'}</AppText>{note.pinned && <Ionicons name="pin" size={16} color={colors.accent} />}</View>
              <AppText color="muted" numberOfLines={5}>{plainText(note.content) || 'Empty note'}</AppText>
              <AppText variant="caption" color="muted">{new Date(note.updatedAt).toLocaleDateString()}</AppText>
            </Card>
          </SilentPressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 }, half: { width: '50%', paddingHorizontal: 5, marginBottom: 10 }, note: { minHeight: 190, gap: 10, padding: 14 },
  grow: { flex: 1 }, spaceBetween: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
});
