import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppInput } from '@/components/ui/AppInput';
import { AppText } from '@/components/ui/AppText';
import { Screen } from '@/components/ui/Screen';
import { ErrorView, LoadingView } from '@/components/ui/StateView';
import { SilentPressable } from '@/components/ui/SilentPressable';
import { useAsyncData } from '@/hooks/useAsyncData';
import { reportError } from '@/lib/errors';
import { useAppPopup } from '@/providers/PopupProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { api } from '@/services/api';
import type { Note } from '@/types/models';

const AUTO_SAVE_DELAY = 650;

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
  disabled,
  onClose,
  onTogglePinned,
  onDelete,
}: {
  visible: boolean;
  pinned: boolean;
  disabled: boolean;
  onClose: () => void;
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
  const { id } = useLocalSearchParams<{ id: string }>();
  const noteId = Array.isArray(id) ? id[0] : id;
  const resource = useAsyncData<Note>(() => api.notes.get(noteId));
  const { setData } = resource;
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
  }, [resource.data]);

  const enqueueSave = useCallback((pending: PendingSave) => {
    const operation = saveChainRef.current.then(async () => {
      try {
        const updated = await api.notes.update(pending.noteId, {
          title: pending.draft.title.trim() || 'Untitled',
          content: pending.draft.content,
        });
        lastSavedDraftRef.current = pending.draft;
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

  const flushPendingSave = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const currentDraft = currentDraftRef.current;
    const noteIdForSave = noteIdRef.current;
    if (noteIdForSave && !draftsMatch(lastSavedDraftRef.current, currentDraft)) {
      const queuedDraft = pendingSaveRef.current?.draft;
      if (!queuedDraft || !draftsMatch(queuedDraft, currentDraft)) {
        pendingSaveRef.current = {
          noteId: noteIdForSave,
          draft: currentDraft,
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
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    const pending = pendingSaveRef.current;
    pendingSaveRef.current = null;
    if (pending) void enqueueSave(pending);
  }, [enqueueSave]);

  useEffect(() => {
    if (!resource.data || initializedNoteIdRef.current !== resource.data.id) return;
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
  }, [content, enqueueSave, resource.data, title]);

  function changeTitle(nextTitle: string) {
    setTitle(nextTitle);
    currentDraftRef.current = { ...currentDraftRef.current, title: nextTitle };
    setError(null);
  }

  function changeContent(nextContent: string) {
    setContent(nextContent);
    currentDraftRef.current = { ...currentDraftRef.current, content: nextContent };
    setError(null);
  }

  async function leave() {
    if (leaving || deleting) return;
    setLeaving(true);
    setOptionsOpen(false);
    await flushPendingSave();
    router.back();
  }

  async function togglePinned() {
    if (!resource.data || deleting) return;
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
    if (!resource.data || !await confirm('Delete note?', resource.data.title, 'Delete')) return;
    setOptionsOpen(false);
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

  return (
    <Screen
      contentStyle={styles.editorContent}
      overlay={resource.data ? (
        <NoteOptionsMenu
          visible={optionsOpen}
          pinned={resource.data.pinned}
          disabled={deleting || leaving}
          onClose={() => setOptionsOpen(false)}
          onTogglePinned={() => void togglePinned()}
          onDelete={() => void remove()} />
      ) : undefined}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <SilentPressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          disabled={leaving || deleting}
          hitSlop={8}
          onPress={() => void leave()}
          style={({ pressed }) => [styles.headerButton, pressed && styles.pressed, (leaving || deleting) && styles.disabled]}>
          <Ionicons name="arrow-back" size={23} color={colors.text} />
        </SilentPressable>
        <AppInput
          value={title}
          onChangeText={changeTitle}
          placeholder="Untitled"
          containerStyle={styles.titleContainer}
          style={[styles.titleInput, { color: colors.text }]}
          editable={!deleting} />
        <SilentPressable
          accessibilityRole="button"
          accessibilityLabel="Note options"
          disabled={deleting}
          hitSlop={8}
          onPress={() => setOptionsOpen(open => !open)}
          style={({ pressed }) => [styles.headerButton, pressed && styles.pressed, deleting && styles.disabled]}>
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
            placeholder="Start writing…"
            containerStyle={styles.bodyContainer}
            style={[styles.bodyInput, { color: colors.text }]}
            editable={!deleting} />
          {error && <AppText color="danger" style={styles.error}>{error}</AppText>}
        </View>
      )}
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
  menu: { position: 'absolute', top: 52, right: 12, width: 184, borderRadius: 16, borderWidth: 1, paddingVertical: 5, shadowColor: '#11111A', shadowOffset: { width: 0, height: 6 }, shadowRadius: 16, shadowOpacity: 0.2, elevation: 8 },
  menuItem: { minHeight: 46, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 11 },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.72 },
});
