import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/ui/AppButton';
import { AppPopup } from '@/components/ui/AppPopup';
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
  const { confirm, showError } = useAppPopup();
  const resource = useAsyncData<NotesData>(async () => {
    const [notes, categories] = await Promise.all([api.notes.all(), api.notes.categories()]);
    return { notes, categories };
  });
  const { reload } = resource;
  const [creating, setCreating] = useState(false);
  const [activeFilter, setActiveFilter] = useState<NotesFilter>('all');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
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
  const selectedNoteIdsForActions = useMemo(
    () => selectedNoteIds.filter(noteId => notes.some(note => note.id === noteId)),
    [notes, selectedNoteIds],
  );
  const selectedNoteIdSet = useMemo(() => new Set(selectedNoteIdsForActions), [selectedNoteIdsForActions]);
  const selectedNotes = useMemo(() => notes.filter(note => selectedNoteIdSet.has(note.id)), [notes, selectedNoteIdSet]);
  const allVisibleSelected = visibleNotes.length > 0 && visibleNotes.every(note => selectedNoteIdSet.has(note.id));
  const allSelectedPinned = selectedNotes.length > 0 && selectedNotes.every(note => note.pinned);

  function openNote(note: Note) {
    if (selectionMode) {
      toggleNoteSelection(note.id);
      return;
    }
    router.push(`/notes/${note.id}`);
  }

  function toggleNoteSelection(noteId: string) {
    setSelectedNoteIds(current => current.includes(noteId)
      ? current.filter(id => id !== noteId)
      : [...current, noteId]);
  }

  function selectAllVisible() {
    const visibleIds = visibleNotes.map(note => note.id);
    setSelectedNoteIds(current => {
      if (visibleIds.every(noteId => current.includes(noteId))) {
        return current.filter(noteId => !visibleIds.includes(noteId));
      }
      return [...new Set([...current, ...visibleIds])];
    });
  }

  function clearSelection() {
    setSelectedNoteIds([]);
    setSelectionMode(false);
    setCategoryPickerOpen(false);
  }

  async function updateSelected(updates: Partial<Pick<Note, 'categoryId' | 'pinned'>>) {
    if (!selectedNoteIdsForActions.length || bulkActionLoading) return;
    setBulkActionLoading(true);
    try {
      const updated = await api.notes.bulkUpdate(selectedNoteIdsForActions, updates);
      const updatedById = new Map(updated.map(note => [note.id, note]));
      resource.setData(current => current ? {
        ...current,
        notes: current.notes.map(note => updatedById.get(note.id) ?? note),
      } : current);
      clearSelection();
    } catch (cause) {
      void showError('Could not update notes', reportError('Could not update notes', cause));
    } finally {
      setBulkActionLoading(false);
    }
  }

  async function deleteSelected() {
    if (!selectedNoteIdsForActions.length || bulkActionLoading) return;
    if (!await confirm('Delete selected notes?', `${selectedNoteIdsForActions.length} notes will be deleted.`, 'Delete')) return;
    setBulkActionLoading(true);
    try {
      await api.notes.bulkRemove(selectedNoteIdsForActions);
      const deletedIds = new Set(selectedNoteIdsForActions);
      resource.setData(current => current ? { ...current, notes: current.notes.filter(note => !deletedIds.has(note.id)) } : current);
      clearSelection();
    } catch (cause) {
      void showError('Could not delete notes', reportError('Could not delete notes', cause));
    } finally {
      setBulkActionLoading(false);
    }
  }

  async function create() {
    setCreating(true);
    try {
      const categoryId = categories.some(category => category.id === activeFilter) ? activeFilter : null;
      const note = await api.notes.create(categoryId);
      resource.setData(current => current ? { ...current, notes: [note, ...current.notes] } : current);
      router.push(`/notes/${note.id}?focus=body`);
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
      <View style={[styles.selectionHeader, { borderColor: colors.border }]}>
        {selectionMode ? (
          <>
            <AppText variant="heading" style={styles.grow}>{selectedNoteIdsForActions.length} selected</AppText>
            <AppButton compact variant="secondary" label={allVisibleSelected ? 'Clear visible' : 'Select all'} onPress={selectAllVisible} disabled={bulkActionLoading || !visibleNotes.length} />
            <AppButton compact variant="ghost" label="Done" onPress={clearSelection} disabled={bulkActionLoading} />
          </>
        ) : (
          <>
            <AppText variant="title" style={styles.grow}>Notes</AppText>
            <AppButton compact variant="secondary" icon="checkbox-outline" label="Select" onPress={() => setSelectionMode(true)} />
          </>
        )}
      </View>
      {selectionMode && selectedNoteIdsForActions.length > 0 && (
        <View style={styles.bulkActions}>
          <AppButton compact variant="ghost" icon={allSelectedPinned ? 'pin' : 'pin-outline'} label={allSelectedPinned ? 'Unpin' : 'Pin'} onPress={() => void updateSelected({ pinned: !allSelectedPinned })} loading={bulkActionLoading} />
          <AppButton compact variant="ghost" icon="folder-open-outline" label="Move" onPress={() => setCategoryPickerOpen(true)} disabled={bulkActionLoading} />
          <AppButton compact variant="danger" icon="trash-outline" label="Delete" onPress={() => void deleteSelected()} disabled={bulkActionLoading} />
        </View>
      )}
      {resource.data && <ChoiceChips value={activeFilter} onChange={setActiveFilter} options={filterOptions} />}
      {!resource.loading && resource.data && !visibleNotes.length && (
        <EmptyView
          title={notes.length ? 'No notes here yet' : 'A quiet notebook'}
          message={notes.length ? 'Choose another category or create a note.' : 'Create a note when you want to keep a thought close.'} />
      )}
      <View style={styles.grid}>
        {visibleNotes.map(note => (
          <SilentPressable
            key={note.id}
            onPress={() => openNote(note)}
            accessibilityRole={selectionMode ? 'checkbox' : 'button'}
            accessibilityState={selectionMode ? { checked: selectedNoteIdSet.has(note.id) } : undefined}
            accessibilityLabel={selectionMode ? `${selectedNoteIdSet.has(note.id) ? 'Deselect' : 'Select'} ${note.title || 'Untitled'}` : `Open ${note.title || 'Untitled'}`}
            style={styles.half}
          >
            <Card style={[styles.note, selectedNoteIdSet.has(note.id) && { borderColor: colors.accent, backgroundColor: colors.accentSoft }]}>
              <View style={styles.spaceBetween}>
                <View style={styles.titleRow}>
                  {selectionMode && <Ionicons name={selectedNoteIdSet.has(note.id) ? 'checkmark-circle' : 'ellipse-outline'} size={19} color={selectedNoteIdSet.has(note.id) ? colors.accent : colors.textMuted} />}
                  <AppText variant="heading" numberOfLines={2} style={styles.grow}>{note.title || 'Untitled'}</AppText>
                </View>
                {note.pinned && <Ionicons name="pin" size={16} color={colors.accent} />}
              </View>
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
      <AppPopup
        visible={categoryPickerOpen}
        title="Move selected notes"
        message="Choose a category for the selected notes."
        showIcon={false}
        onClose={() => setCategoryPickerOpen(false)}
        footer={<AppButton variant="secondary" label="Cancel" onPress={() => setCategoryPickerOpen(false)} />}
      >
        <View style={styles.categoryChoices}>
          <SilentPressable
            accessibilityRole="button"
            onPress={() => void updateSelected({ categoryId: null })}
            style={({ pressed }) => [styles.categoryChoice, { borderColor: colors.border }, pressed && styles.pressed]}
          >
            <AppText variant="label">Uncategorized</AppText>
          </SilentPressable>
          {categories.map(category => (
            <SilentPressable
              key={category.id}
              accessibilityRole="button"
              onPress={() => void updateSelected({ categoryId: category.id })}
              style={({ pressed }) => [styles.categoryChoice, { borderColor: colors.border }, pressed && styles.pressed]}
            >
              <View style={[styles.categoryDot, { backgroundColor: category.color }]} />
              <AppText variant="label">{category.name}</AppText>
            </SilentPressable>
          ))}
        </View>
      </AppPopup>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 0 },
  selectionHeader: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1 },
  bulkActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  newButton: { position: 'absolute', right: 18, shadowColor: '#11111A', shadowOffset: { width: 0, height: 5 }, shadowRadius: 12, shadowOpacity: 0.28, elevation: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 }, half: { width: '50%', paddingHorizontal: 5, marginBottom: 10 }, note: { minHeight: 190, gap: 10, padding: 14 },
  grow: { flex: 1 }, spaceBetween: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 }, titleRow: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  category: { alignSelf: 'flex-start', maxWidth: '100%', minHeight: 24, paddingHorizontal: 8, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 5 }, categoryDot: { width: 6, height: 6, borderRadius: 3 },
  categoryChoices: { gap: 8 }, categoryChoice: { minHeight: 44, paddingHorizontal: 12, borderWidth: 1, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  pressed: { opacity: 0.72 },
});
