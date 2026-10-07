import { Ionicons } from '@expo/vector-icons';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { ModalSheet } from '@/components/ui/ModalSheet';
import { Screen } from '@/components/ui/Screen';
import { SilentPressable } from '@/components/ui/SilentPressable';
import { EmptyView, ErrorView, LoadingView } from '@/components/ui/StateView';
import { useAsyncData } from '@/hooks/useAsyncData';
import { formatShortDate, formatTime } from '@/lib/date';
import { reportError } from '@/lib/errors';
import { TASK_PRIORITY_OPTIONS, taskPriorityColor } from '@/lib/taskPriority';
import { useAppPopup } from '@/providers/PopupProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { api } from '@/services/api';
import type { Project, Task } from '@/types/models';

interface ProjectWorkspace {
  project: Project | null;
  tasks: Task[];
}

function taskScheduleLabel(task: Task): string {
  if (!task.scheduledPerformDateTime) return 'Unscheduled';
  const time = formatTime(task.scheduledPerformDateTime);
  return `${formatShortDate(task.scheduledPerformDateTime)}${time ? ` · ${time}` : ''}`;
}

function ProjectTaskRow({ task, onToggle, onUnassign }: {
  task: Task;
  onToggle: () => void;
  onUnassign: () => void;
}) {
  const { colors } = useAppTheme();
  const priorityColor = taskPriorityColor(task.importance);
  return (
    <Card style={styles.taskRow}>
      <SilentPressable
        hitSlop={10}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: task.completed }}
        onPress={onToggle}>
        <View style={[styles.checkbox, { borderColor: priorityColor }, task.completed && { backgroundColor: priorityColor }]}>
          {task.completed && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
        </View>
      </SilentPressable>
      <View style={styles.taskCopy}>
        <AppText variant="label" numberOfLines={2} style={task.completed ? styles.completed : undefined}>{task.name}</AppText>
        <AppText variant="caption" color="muted">{taskScheduleLabel(task)}</AppText>
      </View>
      <SilentPressable
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${task.name} from this project`}
        onPress={onUnassign}>
        <Ionicons name="unlink-outline" size={21} color={colors.textMuted} />
      </SilentPressable>
    </Card>
  );
}

export default function ProjectDetailScreen() {
  const { colors } = useAppTheme();
  const { confirm, showError } = useAppPopup();
  const { id } = useLocalSearchParams<{ id: string }>();
  const projectId = Array.isArray(id) ? id[0] : id;
  const resource = useAsyncData<ProjectWorkspace>(async () => {
    const [projects, tasks] = await Promise.all([api.projects.all(), api.projects.tasks(projectId)]);
    return { project: projects.find(project => project.projectId === projectId) ?? null, tasks };
  });
  const { reload, setData } = resource;
  const [taskName, setTaskName] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const hasFocusedRef = useRef(false);
  const toggleVersionsRef = useRef(new Map<string, number>());

  useFocusEffect(useCallback(() => {
    if (hasFocusedRef.current) void reload();
    hasFocusedRef.current = true;
  }, [reload]));

  const project = resource.data?.project ?? null;
  const tasks = resource.data?.tasks ?? [];
  const progress = project && project.taskCount > 0 ? project.completedTaskCount / project.taskCount : 0;

  function updateProject(updater: (project: Project) => Project) {
    setData(current => current?.project ? { ...current, project: updater(current.project) } : current);
  }

  function setTaskCompleted(taskId: string, completed: boolean) {
    setData(current => current
      ? { ...current, tasks: current.tasks.map(task => task.taskId === taskId ? { ...task, completed } : task) }
      : current);
  }

  async function toggleTask(task: Task) {
    const nextCompleted = !task.completed;
    const version = (toggleVersionsRef.current.get(task.taskId) ?? 0) + 1;
    toggleVersionsRef.current.set(task.taskId, version);
    setTaskCompleted(task.taskId, nextCompleted);
    updateProject(current => ({
      ...current,
      completedTaskCount: Math.max(0, current.completedTaskCount + (nextCompleted ? 1 : -1)),
    }));
    try {
      const updated = await api.tasks.update(task.taskId, { completed: nextCompleted });
      if (toggleVersionsRef.current.get(task.taskId) !== version) return;
      setData(current => current
        ? { ...current, tasks: current.tasks.map(item => item.taskId === updated.taskId ? updated : item) }
        : current);
    } catch (cause) {
      if (toggleVersionsRef.current.get(task.taskId) !== version) return;
      setData(current => {
        const currentTask = current?.tasks.find(item => item.taskId === task.taskId);
        if (!current || !currentTask || currentTask.completed !== nextCompleted) return current;
        return {
          project: current.project ? {
            ...current.project,
            completedTaskCount: Math.max(0, current.project.completedTaskCount + (nextCompleted ? -1 : 1)),
          } : null,
          tasks: current.tasks.map(item => item.taskId === task.taskId ? { ...item, completed: task.completed } : item),
        };
      });
      void showError('Could not update task', reportError('Could not update task', cause));
    }
  }

  async function unassignTask(task: Task) {
    const index = tasks.findIndex(item => item.taskId === task.taskId);
    if (index < 0) return;
    setData(current => current
      ? { ...current, tasks: current.tasks.filter(item => item.taskId !== task.taskId) }
      : current);
    updateProject(current => ({
      ...current,
      taskCount: Math.max(0, current.taskCount - 1),
      completedTaskCount: Math.max(0, current.completedTaskCount - (task.completed ? 1 : 0)),
    }));
    try {
      await api.tasks.update(task.taskId, { projectId: null });
    } catch (cause) {
      setData(current => {
        if (!current || current.tasks.some(item => item.taskId === task.taskId)) return current;
        const restored = [...current.tasks];
        restored.splice(Math.min(index, restored.length), 0, task);
        return {
          project: current.project ? {
            ...current.project,
            taskCount: current.project.taskCount + 1,
            completedTaskCount: current.project.completedTaskCount + (task.completed ? 1 : 0),
          } : null,
          tasks: restored,
        };
      });
      void showError('Could not remove task from project', reportError('Could not remove task from project', cause));
    }
  }

  async function addTask() {
    const name = taskName.trim();
    if (!name || adding) return;
    setAdding(true);
    setAddError(null);
    try {
      const created = await api.tasks.create({
        name,
        description: '',
        scheduledPerformDateTime: '',
        tag: '',
        importance: TASK_PRIORITY_OPTIONS[0].value,
        projectId,
      });
      setData(current => current ? { ...current, tasks: [created, ...current.tasks] } : current);
      updateProject(current => ({ ...current, taskCount: current.taskCount + 1 }));
      setTaskName('');
    } catch (cause) {
      setAddError(reportError('Could not add task', cause));
    } finally {
      setAdding(false);
    }
  }

  function openEdit() {
    if (!project) return;
    setEditName(project.name);
    setEditDescription(project.description ?? '');
    setEditError(null);
    setEditing(true);
  }

  async function saveEdit() {
    if (!project || savingEdit) return;
    const name = editName.trim();
    if (!name) {
      setEditError('Give the project a name.');
      return;
    }
    setSavingEdit(true);
    setEditError(null);
    try {
      const updated = await api.projects.update(projectId, {
        name,
        description: editDescription.trim() || null,
      });
      setData(current => current ? { ...current, project: updated } : current);
      setEditing(false);
    } catch (cause) {
      setEditError(reportError('Could not save project', cause));
    } finally {
      setSavingEdit(false);
    }
  }

  async function removeProject() {
    if (!project || deleting) return;
    if (!await confirm('Delete project?', 'Its tasks will stay in Tasks without a project.', 'Delete')) return;
    setDeleting(true);
    try {
      await api.projects.remove(projectId);
      router.back();
    } catch (cause) {
      setDeleting(false);
      void showError('Could not delete project', reportError('Could not delete project', cause));
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: project?.name ?? 'Project' }} />
      <Screen
        safeAreaTop={false}
        refreshing={resource.refreshing}
        onRefresh={() => void resource.reload()}>
        {resource.loading && !resource.data && <LoadingView label="Loading project…" />}
        {resource.error && !resource.data && <ErrorView message={resource.error} retry={() => void resource.reload()} />}
        {resource.data && !project && (
          <EmptyView
            title="Project not found"
            message="It may have been deleted. Go back to choose another project." />
        )}
        {project && (
          <>
            <Card style={styles.summary}>
              {project.description ? <AppText color="muted">{project.description}</AppText> : null}
              <View style={styles.progressRow}>
                <AppText variant="label" color="accent">{project.completedTaskCount}/{project.taskCount} done</AppText>
                {project.taskCount > 0 && <AppText variant="caption" color="muted">{Math.round(progress * 100)}%</AppText>}
              </View>
              <View
                accessibilityLabel={`${project.completedTaskCount} of ${project.taskCount} tasks completed`}
                style={[styles.track, { backgroundColor: colors.border }]}>
                <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: colors.accent }]} />
              </View>
              <View style={styles.actions}>
                <AppButton compact variant="secondary" icon="create-outline" label="Edit" onPress={openEdit} />
                <AppButton compact variant="danger" icon="trash-outline" label="Delete" loading={deleting} onPress={() => void removeProject()} />
              </View>
            </Card>
            <View style={styles.quickAdd}>
              <AppInput
                containerStyle={styles.quickAddInput}
                placeholder="Add a task…"
                value={taskName}
                onChangeText={value => { setTaskName(value); setAddError(null); }}
                onSubmitEditing={() => void addTask()}
                returnKeyType="done"
                submitBehavior="submit" />
              <AppButton label="Add task" icon="add" loading={adding} onPress={() => void addTask()} />
            </View>
            {addError && <AppText variant="caption" color="danger">{addError}</AppText>}
            <View style={styles.list}>
              {tasks.map(task => (
                <ProjectTaskRow
                  key={task.taskId}
                  task={task}
                  onToggle={() => void toggleTask(task)}
                  onUnassign={() => void unassignTask(task)} />
              ))}
            </View>
            {!tasks.length && (
              <EmptyView
                title="No tasks in this project"
                message="Add one above, or assign an existing task from the Tasks tab." />
            )}
          </>
        )}
        <ModalSheet
          visible={editing}
          onClose={() => setEditing(false)}
          title="Edit project"
          footer={<AppButton label="Save changes" loading={savingEdit} onPress={() => void saveEdit()} />}>
          <AppInput
            autoFocus
            label="Project name"
            value={editName}
            onChangeText={value => { setEditName(value); setEditError(null); }}
            error={editError ?? undefined} />
          <AppInput label="Description (optional)" multiline value={editDescription} onChangeText={setEditDescription} />
        </ModalSheet>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  summary: { gap: 12 },
  progressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  actions: { flexDirection: 'row', gap: 10 },
  quickAdd: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  quickAddInput: { flex: 1, minWidth: 0 },
  list: { gap: 10 },
  taskRow: { padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkbox: { width: 18, height: 18, borderWidth: 1.75, borderRadius: 2, alignItems: 'center', justifyContent: 'center' },
  taskCopy: { flex: 1, gap: 3 },
  completed: { textDecorationLine: 'line-through', opacity: 0.52 },
});
