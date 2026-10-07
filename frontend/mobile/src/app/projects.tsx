import { router, useFocusEffect } from 'expo-router';
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
import { reportError } from '@/lib/errors';
import { useAppTheme } from '@/providers/ThemeProvider';
import { api } from '@/services/api';
import type { Project } from '@/types/models';

function progressRatio(project: Project): number {
  return project.taskCount > 0 ? project.completedTaskCount / project.taskCount : 0;
}

function ProjectComposerSheet({ visible, onClose, onCreated }: {
  visible: boolean;
  onClose: () => void;
  onCreated: (project: Project) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    setName('');
    setDescription('');
    setError(null);
    onClose();
  }

  async function submit() {
    if (!name.trim()) {
      setError('Give the project a name.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const project = await api.projects.create({
        name: name.trim(),
        description: description.trim() || null,
      });
      onCreated(project);
      close();
    } catch (cause) {
      setError(reportError('Could not create project', cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalSheet
      visible={visible}
      onClose={close}
      title="New project"
      footer={<AppButton label="Create project" icon="add" loading={saving} onPress={() => void submit()} />}>
      <AppInput
        autoFocus
        label="Project name"
        value={name}
        onChangeText={value => { setName(value); setError(null); }}
        error={error ?? undefined} />
      <AppInput label="Description (optional)" multiline value={description} onChangeText={setDescription} />
    </ModalSheet>
  );
}

export default function ProjectsScreen() {
  const { colors } = useAppTheme();
  const resource = useAsyncData<Project[]>(() => api.projects.all());
  const { reload } = resource;
  const [composerOpen, setComposerOpen] = useState(false);
  const hasFocusedRef = useRef(false);

  useFocusEffect(useCallback(() => {
    if (hasFocusedRef.current) void reload();
    hasFocusedRef.current = true;
  }, [reload]));

  const projects = resource.data ?? [];

  function addProject(project: Project) {
    resource.setData(current => [project, ...(current ?? [])]);
  }

  return (
    <Screen
      safeAreaTop={false}
      action={<AppButton compact label="New" icon="add" onPress={() => setComposerOpen(true)} />}
      refreshing={resource.refreshing}
      onRefresh={() => void resource.reload()}>
      {resource.loading && !resource.data && <LoadingView label="Loading projects…" />}
      {resource.error && !resource.data && <ErrorView message={resource.error} retry={() => void resource.reload()} />}
      {!resource.loading && resource.data && !projects.length && (
        <EmptyView
          title="No projects yet"
          message="Group related tasks so one outcome stays in view." />
      )}
      {projects.map(project => (
        <SilentPressable
          key={project.projectId}
          accessibilityRole="button"
          accessibilityLabel={`Open project ${project.name}`}
          onPress={() => router.push(`/projects/${project.projectId}`)}>
          <Card style={styles.project}>
            <View style={styles.headingRow}>
              <AppText variant="heading" numberOfLines={2} style={styles.grow}>{project.name}</AppText>
              <AppText variant="caption" color="muted">{project.completedTaskCount}/{project.taskCount}</AppText>
            </View>
            {project.description ? (
              <AppText color="muted" numberOfLines={1}>{project.description}</AppText>
            ) : null}
            <View
              accessibilityLabel={`${project.completedTaskCount} of ${project.taskCount} tasks completed`}
              style={[styles.track, { backgroundColor: colors.border }]}>
              <View style={[styles.fill, { width: `${progressRatio(project) * 100}%`, backgroundColor: colors.accent }]} />
            </View>
          </Card>
        </SilentPressable>
      ))}
      <ProjectComposerSheet visible={composerOpen} onClose={() => setComposerOpen(false)} onCreated={addProject} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  project: { gap: 10 },
  headingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  grow: { flex: 1 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
});
