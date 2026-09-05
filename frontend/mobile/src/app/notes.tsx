import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/ui/AppButton';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { ChoiceChips } from '@/components/ui/ChoiceChips';
import { Screen } from '@/components/ui/Screen';
import { SilentPressable } from '@/components/ui/SilentPressable';
import { EmptyView, ErrorView, LoadingView } from '@/components/ui/StateView';
import { useAsyncData } from '@/hooks/useAsyncData';
import { reportError } from '@/lib/errors';
import { useAppPopup } from '@/providers/PopupProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { api } from '@/services/api';
import type { Note, NoteCategory } from '@/types/models';

type NotesData = {
  notes: Note[];
  categories: NoteCategory[];
};

type NotesFilter = 'all' | 'pinned' | 'uncategorized' | string;

const EMPTY_NOTES: Note[] = [];
const EMPTY_CATEGORIES: NoteCategory[] = [];

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
  const insets = useSafeAreaInsets();
  const { showError } = useAppPopup();
  const resource = useAsyncData<NotesData>(async () => {
    const [notes, categories] = await Promise.all([api.notes.all(), api.notes.categories()]);
    return { notes, categories };
  });
  const { reload } = resource;
  const [creating, setCreating] = useState(false);
  const [activeFilter, setActiveFilter] = useState<NotesFilter>('all');
  const hasFocusedRef = useRef(false);

  useFocusEffect(useCallback(() => {
    if (hasFocusedRef.current) void reload();
    hasFocusedRef.current = true;
  }, [reload]));

  const notes = resource.data?.notes ?? EMPTY_NOTES;
  const categories = resource.data?.categories ?? EMPTY_CATEGORIES;
  const categoryById = useMemo(() => new Map(categories.map(category => [category.id, category])), [categories]);
  const filterOptions = useMemo(() => [
    { value: 'all', label: 'All notes', color: colors.accent },
    { value: 'pinned', label: 'Pinned', color: colors.secondary },
    { value: 'uncategorized', label: 'Uncategorized', color: colors.textMuted },
    ...categories.map(category => ({ value: category.id, label: category.name, color: category.color })),
  ], [categories, colors.accent, colors.secondary, colors.textMuted]);
  const visibleNotes = useMemo(() => [...notes]
    .filter(note => {
      if (activeFilter === 'pinned') return note.pinned;
      if (activeFilter === 'uncategorized') return note.categoryId === null;
      if (activeFilter !== 'all') return note.categoryId === activeFilter;
      return true;
    })
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt)), [activeFilter, notes]);

  function openNote(note: Note) {
    router.push(`/notes/${note.id}`);
  }

  async function create() {
    setCreating(true);
    try {
      const categoryId = categories.some(category => category.id === activeFilter) ? activeFilter : null;
      const note = await api.notes.create(categoryId);
      resource.setData(current => current ? { ...current, notes: [note, ...current.notes] } : current);
      router.push(`/notes/${note.id}`);
    } catch (cause) { void showError('Could not create note', reportError('Could not create note', cause)); }
    finally { setCreating(false); }
  }

  return (
    <Screen
      safeAreaTop={false}
      contentStyle={styles.content}
      overlay={(
        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
          <AppButton
            compact
            label="New"
            icon="add"
            loading={creating}
            onPress={() => void create()}
            style={[styles.newButton, { bottom: Math.max(24, insets.bottom + 12) }]}
          />
        </View>
      )}
      refreshing={resource.refreshing}
      onRefresh={() => void resource.reload()}>
      {resource.loading && <LoadingView label="Loading notes…" />}
      {resource.error && !resource.data && <ErrorView message={resource.error} retry={() => void resource.reload()} />}
      {resource.data && <ChoiceChips value={activeFilter} onChange={setActiveFilter} options={filterOptions} />}
      {!resource.loading && resource.data && !visibleNotes.length && (
        <EmptyView
          title={notes.length ? 'No notes here yet' : 'A quiet notebook'}
          message={notes.length ? 'Choose another category or create a note.' : 'Create a note when you want to keep a thought close.'} />
      )}
      <View style={styles.grid}>
        {visibleNotes.map(note => (
          <SilentPressable key={note.id} onPress={() => openNote(note)} style={styles.half}>
            <Card style={styles.note}>
              <View style={styles.spaceBetween}><AppText variant="heading" numberOfLines={2} style={styles.grow}>{note.title || 'Untitled'}</AppText>{note.pinned && <Ionicons name="pin" size={16} color={colors.accent} />}</View>
              <AppText color="muted" numberOfLines={5}>{plainText(note.content) || 'Empty note'}</AppText>
              {note.categoryId && categoryById.get(note.categoryId) && (
                <View style={[styles.category, { backgroundColor: `${categoryById.get(note.categoryId)?.color}18`, borderColor: categoryById.get(note.categoryId)?.color }]}>
                  <View style={[styles.categoryDot, { backgroundColor: categoryById.get(note.categoryId)?.color }]} />
                  <AppText variant="caption" numberOfLines={1} style={{ color: categoryById.get(note.categoryId)?.color }}>{categoryById.get(note.categoryId)?.name}</AppText>
                </View>
              )}
              <AppText variant="caption" color="muted">{new Date(note.updatedAt).toLocaleDateString()}</AppText>
            </Card>
          </SilentPressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 0 },
  newButton: { position: 'absolute', right: 18, shadowColor: '#11111A', shadowOffset: { width: 0, height: 5 }, shadowRadius: 12, shadowOpacity: 0.28, elevation: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 }, half: { width: '50%', paddingHorizontal: 5, marginBottom: 10 }, note: { minHeight: 190, gap: 10, padding: 14 },
  grow: { flex: 1 }, spaceBetween: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  category: { alignSelf: 'flex-start', maxWidth: '100%', minHeight: 24, paddingHorizontal: 8, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 5 }, categoryDot: { width: 6, height: 6, borderRadius: 3 },
});
