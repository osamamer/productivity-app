import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { AppPopup } from '@/components/ui/AppPopup';
import { AppText } from '@/components/ui/AppText';
import { Screen } from '@/components/ui/Screen';
import { ErrorView, LoadingView } from '@/components/ui/StateView';
import { SilentPressable } from '@/components/ui/SilentPressable';
import { useAsyncData } from '@/hooks/useAsyncData';
import { reportError } from '@/lib/errors';
import { useAppPopup } from '@/providers/PopupProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { api } from '@/services/api';
import type { Note, NoteCategory } from '@/types/models';

const AUTO_SAVE_DELAY = 650;
const UNTITLED_TITLE = 'Untitled';

type Draft = {
  title: string;
  content: string;
};

type PendingSave = {
  noteId: string;
  draft: Draft;
  version: number;
};

function plainText(content: string): string {
  return content
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim();
}

function draftsMatch(left: Draft | null, right: Draft): boolean {
  return left?.title === right.title && left.content === right.content;
}

function NoteOptionsMenu({
  visible,
  pinned,
  categoryName,
  disabled,
  onClose,
  onChangeCategory,
  onTogglePinned,
  onDelete,
}: {
  visible: boolean;
  pinned: boolean;
  categoryName: string;
  disabled: boolean;
  onClose: () => void;
  onChangeCategory: () => void;
  onTogglePinned: () => void;
  onDelete: () => void;
}) {
  const { colors } = useAppTheme();
  if (!visible) return null;

  return (
    <View style={styles.menuOverlay} pointerEvents="box-none">
      <SilentPressable
        accessibilityRole="button"
        accessibilityLabel="Close note options"
        style={styles.menuDismiss}
        onPress={onClose} />
      <View style={[styles.menu, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <SilentPressable
          accessibilityRole="button"
          accessibilityLabel={`Change note category, currently ${categoryName}`}
          disabled={disabled}
          onPress={onChangeCategory}
          style={({ pressed }) => [styles.menuItem, pressed && styles.pressed, disabled && styles.disabled]}>
          <Ionicons name="folder-open-outline" size={19} color={colors.accent} />
          <View style={styles.menuItemText}>
            <AppText variant="label">Category</AppText>
            <AppText variant="caption" color="muted" numberOfLines={1}>{categoryName}</AppText>
          </View>
        </SilentPressable>
        <SilentPressable
          accessibilityRole="button"
          accessibilityLabel={pinned ? 'Unpin note' : 'Pin note'}
          disabled={disabled}
          onPress={onTogglePinned}
          style={({ pressed }) => [styles.menuItem, pressed && styles.pressed, disabled && styles.disabled]}>
          <Ionicons name={pinned ? 'pin' : 'pin-outline'} size={19} color={colors.accent} />
          <AppText variant="label">{pinned ? 'Unpin note' : 'Pin note'}</AppText>
        </SilentPressable>
        <SilentPressable
          accessibilityRole="button"
          accessibilityLabel="Delete note"
          disabled={disabled}
          onPress={onDelete}
          style={({ pressed }) => [styles.menuItem, pressed && styles.pressed, disabled && styles.disabled]}>
          <Ionicons name="trash-outline" size={19} color={colors.danger} />
          <AppText variant="label" style={{ color: colors.danger }}>Delete note</AppText>
        </SilentPressable>
      </View>
    </View>
  );
}

export default function NoteEditorScreen() {
  const { colors } = useAppTheme();
  const { confirm } = useAppPopup();
  const { id, focus } = useLocalSearchParams<{ id: string; focus?: string }>();
  const noteId = Array.isArray(id) ? id[0] : id;
  const focusTarget = Array.isArray(focus) ? focus[0] : focus;
  const resource = useAsyncData<Note>(() => api.notes.get(noteId));
  const categoriesResource = useAsyncData<NoteCategory[]>(() => api.notes.categories());
  const { setData } = resource;
  const categories = categoriesResource.data ?? [];
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [categoryUpdating, setCategoryUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydratedNoteId, setHydratedNoteId] = useState<string | null>(null);
  const initializedNoteIdRef = useRef<string | null>(null);
  const noteIdRef = useRef<string | null>(null);
  const currentDraftRef = useRef<Draft>({ title: '', content: '' });
  const lastSavedDraftRef = useRef<Draft | null>(null);
  const pendingSaveRef = useRef<PendingSave | null>(null);
  const saveVersionRef = useRef(0);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    if (!resource.data || initializedNoteIdRef.current === resource.data.id) return;
    const draft = {
      title: resource.data.title,
      content: plainText(resource.data.content),
    };
    initializedNoteIdRef.current = resource.data.id;
    noteIdRef.current = resource.data.id;
    currentDraftRef.current = draft;
    lastSavedDraftRef.current = draft;
    setTitle(draft.title);
    setContent(draft.content);
    setHydratedNoteId(resource.data.id);
  }, [resource.data]);

  const enqueueSave = useCallback((pending: PendingSave) => {
    const operation = saveChainRef.current.then(async () => {
      try {
        const title = pending.draft.title.trim();
        const updated = await api.notes.update(pending.noteId, {
          ...(title ? { title } : {}),
          content: pending.draft.content,
        });
        lastSavedDraftRef.current = {
          ...pending.draft,
          title: title ? updated.title : pending.draft.title,
        };
        if (title && currentDraftRef.current.title === pending.draft.title) {
          currentDraftRef.current = { ...currentDraftRef.current, title: updated.title };
          setTitle(current => current === pending.draft.title ? updated.title : current);
        }
        if (saveVersionRef.current === pending.version) {
          setData(current => current?.id === pending.noteId ? updated : current);
          setError(null);
        }
      } catch (cause) {
        if (saveVersionRef.current === pending.version) {
          setError(reportError('Could not save note', cause));
        }
      }
    });
    saveChainRef.current = operation.catch(() => undefined);
    return operation;
  }, [setData]);

  const flushPendingSave = useCallback(async (ensureTitle = false) => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const currentDraft = currentDraftRef.current;
    const draftToSave = ensureTitle && !currentDraft.title.trim()
      ? { ...currentDraft, title: UNTITLED_TITLE }
      : currentDraft;
    if (draftToSave !== currentDraft) {
      currentDraftRef.current = draftToSave;
      setTitle(draftToSave.title);
    }
    const noteIdForSave = noteIdRef.current;
    if (noteIdForSave && !draftsMatch(lastSavedDraftRef.current, draftToSave)) {
      const queuedDraft = pendingSaveRef.current?.draft;
      if (!queuedDraft || !draftsMatch(queuedDraft, draftToSave)) {
        pendingSaveRef.current = {
          noteId: noteIdForSave,
          draft: draftToSave,
          version: ++saveVersionRef.current,
        };
      }
    }

    const pending = pendingSaveRef.current;
    pendingSaveRef.current = null;
    const pendingOperation = pending ? enqueueSave(pending) : Promise.resolve();
    await pendingOperation;
    await saveChainRef.current;
  }, [enqueueSave]);

  useEffect(() => () => {
    void flushPendingSave(true);
  }, [flushPendingSave]);

  useEffect(() => {
    if (!resource.data || hydratedNoteId !== resource.data.id) return;
    const draft = { title, content };
    currentDraftRef.current = draft;
    if (draftsMatch(lastSavedDraftRef.current, draft)) return;

    pendingSaveRef.current = {
      noteId: resource.data.id,
      draft,
      version: ++saveVersionRef.current,
    };
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      const pending = pendingSaveRef.current;
      pendingSaveRef.current = null;
      if (pending) void enqueueSave(pending);
    }, AUTO_SAVE_DELAY);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [content, enqueueSave, hydratedNoteId, resource.data, title]);

  function changeTitle(nextTitle: string) {
    setTitle(nextTitle);
    currentDraftRef.current = { ...currentDraftRef.current, title: nextTitle };
    setError(null);
  }

  function changeContent(nextContent: string) {
    const nextTitle = !currentDraftRef.current.title.trim() && nextContent.trim()
      ? UNTITLED_TITLE
      : currentDraftRef.current.title;
    if (nextTitle !== currentDraftRef.current.title) setTitle(nextTitle);
    setContent(nextContent);
    currentDraftRef.current = { title: nextTitle, content: nextContent };
    setError(null);
  }

  async function leave() {
    if (leaving || deleting || categoryUpdating) return;
    setLeaving(true);
    setOptionsOpen(false);
    setCategoryPickerOpen(false);
    await flushPendingSave(true);
    router.back();
  }

  async function togglePinned() {
    if (!resource.data || deleting || categoryUpdating) return;
    setOptionsOpen(false);
    await flushPendingSave();
    try {
      const updated = await api.notes.update(resource.data.id, { pinned: !resource.data.pinned });
      setData(updated);
    } catch (cause) {
      setError(reportError('Could not update note', cause));
    }
  }

  async function remove() {
    if (!resource.data || deleting || leaving || categoryUpdating || !await confirm('Delete note?', resource.data.title || 'Untitled note', 'Delete')) return;
    setOptionsOpen(false);
    setCategoryPickerOpen(false);
    setDeleting(true);
    try {
      await flushPendingSave();
      await api.notes.remove(resource.data.id);
      router.back();
    } catch (cause) {
      setError(reportError('Could not delete note', cause));
      setDeleting(false);
    }
  }

  async function updateCategory(categoryId: string | null) {
    if (!resource.data || deleting || leaving || categoryUpdating) return;
    if (resource.data.categoryId === categoryId) {
      setCategoryPickerOpen(false);
      return;
    }

    const previousCategoryId = resource.data.categoryId;
    setCategoryPickerOpen(false);
    setOptionsOpen(false);
    setCategoryUpdating(true);
    setData(current => current ? { ...current, categoryId } : current);
    try {
      await flushPendingSave();
      const updated = await api.notes.update(resource.data.id, { categoryId });
      setData(updated);
      setError(null);
    } catch (cause) {
      setData(current => current ? { ...current, categoryId: previousCategoryId } : current);
      setError(reportError('Could not update note category', cause));
    } finally {
      setCategoryUpdating(false);
    }
  }

  const categoryName = categories.find(category => category.id === resource.data?.categoryId)?.name ?? 'Uncategorized';
  const editorDisabled = deleting || leaving || categoryUpdating;

  return (
    <Screen
      contentStyle={styles.editorContent}
      overlay={resource.data ? (
        <NoteOptionsMenu
          visible={optionsOpen}
          pinned={resource.data.pinned}
          categoryName={categoryName}
          disabled={editorDisabled}
          onClose={() => setOptionsOpen(false)}
          onChangeCategory={() => {
            setOptionsOpen(false);
            setCategoryPickerOpen(true);
          }}
          onTogglePinned={() => void togglePinned()}
          onDelete={() => void remove()} />
      ) : undefined}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <SilentPressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          disabled={editorDisabled}
          hitSlop={8}
          onPress={() => void leave()}
          style={({ pressed }) => [styles.headerButton, pressed && styles.pressed, editorDisabled && styles.disabled]}>
          <Ionicons name="arrow-back" size={23} color={colors.text} />
        </SilentPressable>
        <AppInput
          value={title}
          onChangeText={changeTitle}
          placeholder="Add a title…"
          containerStyle={styles.titleContainer}
          style={[styles.titleInput, { color: colors.text }]}
          editable={!editorDisabled} />
        <SilentPressable
          accessibilityRole="button"
          accessibilityLabel="Note options"
          disabled={editorDisabled}
          hitSlop={8}
          onPress={() => setOptionsOpen(open => !open)}
          style={({ pressed }) => [styles.headerButton, pressed && styles.pressed, editorDisabled && styles.disabled]}>
          <Ionicons name="ellipsis-horizontal" size={23} color={colors.text} />
        </SilentPressable>
      </View>

      {resource.loading && <LoadingView label="Loading note…" />}
      {resource.error && !resource.data && <ErrorView message={resource.error} retry={() => void resource.reload()} />}
      {resource.data && (
        <View style={styles.workspace}>
          <AppInput
            multiline
            value={content}
            onChangeText={changeContent}
            autoFocus={focusTarget === 'body' && Boolean(hydratedNoteId)}
            placeholder="Start writing…"
            containerStyle={styles.bodyContainer}
            style={[styles.bodyInput, { color: colors.text }]}
            editable={!editorDisabled} />
          {error && <AppText color="danger" style={styles.error}>{error}</AppText>}
        </View>
      )}
      <AppPopup
        visible={categoryPickerOpen}
        title="Note category"
        message="Choose a category for this note."
        showIcon={false}
        onClose={() => setCategoryPickerOpen(false)}
        footer={<AppButton variant="secondary" label="Cancel" onPress={() => setCategoryPickerOpen(false)} disabled={categoryUpdating} />}>
        <View style={styles.categoryChoices}>
          <SilentPressable
            accessibilityRole="button"
            accessibilityLabel="Move note to Uncategorized"
            disabled={categoryUpdating}
            onPress={() => void updateCategory(null)}
            style={({ pressed }) => [styles.categoryChoice, { borderColor: colors.border }, pressed && styles.pressed, categoryUpdating && styles.disabled]}>
            <AppText variant="label">Uncategorized</AppText>
            {resource.data?.categoryId === null && <Ionicons name="checkmark" size={18} color={colors.accent} />}
          </SilentPressable>
          {categories.map(category => (
            <SilentPressable
              key={category.id}
              accessibilityRole="button"
              accessibilityLabel={`Move note to ${category.name}`}
              disabled={categoryUpdating}
              onPress={() => void updateCategory(category.id)}
              style={({ pressed }) => [styles.categoryChoice, { borderColor: colors.border }, pressed && styles.pressed, categoryUpdating && styles.disabled]}>
              <View style={[styles.categoryDot, { backgroundColor: category.color }]} />
              <AppText variant="label" style={styles.categoryChoiceLabel}>{category.name}</AppText>
              {resource.data?.categoryId === category.id && <Ionicons name="checkmark" size={18} color={colors.accent} />}
            </SilentPressable>
          ))}
          {!categoriesResource.loading && !categories.length && (
            <AppText color="muted">No custom categories yet.</AppText>
          )}
        </View>
      </AppPopup>
    </Screen>
  );
}

const styles = StyleSheet.create({
  editorContent: { flexGrow: 1, paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0, gap: 0 },
  header: { minHeight: 58, paddingHorizontal: 14, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerButton: { width: 36, height: 42, alignItems: 'center', justifyContent: 'center' },
  titleContainer: { flex: 1, gap: 0 },
  titleInput: { minHeight: 42, borderWidth: 0, borderColor: 'transparent', borderRadius: 0, paddingHorizontal: 0, paddingVertical: 8, fontSize: 20, lineHeight: 26, fontWeight: '700', backgroundColor: 'transparent' },
  workspace: { flex: 1, minHeight: 600 },
  bodyContainer: { flex: 1, gap: 0 },
  bodyInput: { flex: 1, minHeight: 600, borderWidth: 0, borderColor: 'transparent', borderRadius: 0, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 30, backgroundColor: 'transparent' },
  error: { paddingHorizontal: 18, paddingBottom: 10 },
  menuOverlay: { ...StyleSheet.absoluteFill, zIndex: 10 },
  menuDismiss: { ...StyleSheet.absoluteFill },
  menu: { position: 'absolute', top: 52, right: 12, width: 220, borderRadius: 16, borderWidth: 1, paddingVertical: 5, shadowColor: '#11111A', shadowOffset: { width: 0, height: 6 }, shadowRadius: 16, shadowOpacity: 0.2, elevation: 8 },
  menuItem: { minHeight: 46, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 11 },
  menuItemText: { flex: 1, gap: 2 },
  categoryChoices: { gap: 8 },
  categoryChoice: { minHeight: 44, paddingHorizontal: 12, borderWidth: 1, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  categoryChoiceLabel: { flex: 1 },
  categoryDot: { width: 8, height: 8, borderRadius: 4 },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.72 },
});
