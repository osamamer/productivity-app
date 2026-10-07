import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { projectService } from '../services/api/projectService';
import { invalidateResource } from '../services/cache/resourceInvalidation';
import { Project, ProjectInput } from '../types/Project';
import { Task } from '../types/Task';

const LOAD_ERROR_MESSAGE = 'Could not load your projects.';
const CREATE_ERROR_MESSAGE = 'Could not create the project.';
const SAVE_ERROR_MESSAGE = 'Could not save the project.';
const DELETE_ERROR_MESSAGE = 'Could not delete the project.';
const TASK_LOAD_ERROR_MESSAGE = 'Could not load the tasks in this project.';

function compareProjectNames(first: Project, second: Project): number {
    return first.name.localeCompare(second.name, undefined, { sensitivity: 'base' });
}

function omitProjectTasks(tasksByProject: Record<string, Task[]>, projectId: string): Record<string, Task[]> {
    if (!(projectId in tasksByProject)) return tasksByProject;
    const next = { ...tasksByProject };
    delete next[projectId];
    return next;
}

export function useProjectsWorkspace() {
    const [projects, setProjects] = useState<Project[]>(() => projectService.getCachedProjects() ?? []);
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
    const [tasksByProject, setTasksByProject] = useState<Record<string, Task[]>>({});
    const [loading, setLoading] = useState(true);
    const [tasksLoadingProjectId, setTasksLoadingProjectId] = useState<string | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [operationError, setOperationError] = useState<string | null>(null);
    const projectsRef = useRef(projects);
    const selectedProjectIdRef = useRef<string | null>(null);
    const tasksByProjectRef = useRef(tasksByProject);
    const taskLoadVersionsRef = useRef(new Map<string, number>());
    const refreshSequenceRef = useRef(0);
    const projectsMutationVersionRef = useRef(0);
    const quickAddSequenceRef = useRef(0);
    const quickAddOrderRef = useRef(new Map<string, number>());

    useEffect(() => {
        tasksByProjectRef.current = tasksByProject;
    }, [tasksByProject]);

    const applyProjects = useCallback((nextProjects: Project[]) => {
        projectsRef.current = nextProjects;
        setProjects(nextProjects);
    }, []);

    const refreshProjects = useCallback(async ({ quiet = false }: { quiet?: boolean } = {}) => {
        const sequence = refreshSequenceRef.current + 1;
        refreshSequenceRef.current = sequence;
        const mutationVersion = projectsMutationVersionRef.current;
        if (!quiet && projectsRef.current.length === 0) setLoading(true);

        try {
            const latestProjects = await projectService.getProjects();
            if (refreshSequenceRef.current !== sequence
                || projectsMutationVersionRef.current !== mutationVersion) return;
            applyProjects(latestProjects);
            setLoadError(null);
        } catch (error) {
            console.error('Could not load projects.', error);
            if (refreshSequenceRef.current !== sequence) return;
            if (projectsRef.current.length === 0) {
                setLoadError(LOAD_ERROR_MESSAGE);
            } else if (!quiet) {
                setOperationError(LOAD_ERROR_MESSAGE);
            }
        } finally {
            if (refreshSequenceRef.current === sequence) setLoading(false);
        }
    }, [applyProjects]);

    useEffect(() => {
        void refreshProjects();
    }, [refreshProjects]);

    useEffect(() => {
        const currentId = selectedProjectIdRef.current;
        if (currentId && projects.some(project => project.projectId === currentId)) return;
        const nextId = projects[0]?.projectId ?? null;
        selectedProjectIdRef.current = nextId;
        setSelectedProjectId(nextId);
    }, [projects]);

    const loadProjectTasks = useCallback(async (projectId: string, { quiet = false } = {}) => {
        const version = (taskLoadVersionsRef.current.get(projectId) ?? 0) + 1;
        taskLoadVersionsRef.current.set(projectId, version);
        if (!quiet && !tasksByProjectRef.current[projectId]) setTasksLoadingProjectId(projectId);

        try {
            const tasks = await projectService.getProjectTasks(projectId);
            if (taskLoadVersionsRef.current.get(projectId) !== version) return;
            setTasksByProject(current => ({ ...current, [projectId]: tasks }));
        } catch (error) {
            console.error(`Could not load tasks for project ${projectId}.`, error);
            if (taskLoadVersionsRef.current.get(projectId) === version) setOperationError(TASK_LOAD_ERROR_MESSAGE);
        } finally {
            if (taskLoadVersionsRef.current.get(projectId) === version) {
                setTasksLoadingProjectId(current => current === projectId ? null : current);
            }
        }
    }, []);

    useEffect(() => {
        if (!selectedProjectId) return;
        const hasCachedTasks = Boolean(tasksByProjectRef.current[selectedProjectId]);
        void loadProjectTasks(selectedProjectId, { quiet: hasCachedTasks });
    }, [loadProjectTasks, selectedProjectId]);

    const selectProject = useCallback((projectId: string | null) => {
        selectedProjectIdRef.current = projectId;
        setSelectedProjectId(projectId);
    }, []);

    const createProject = useCallback(async (input: ProjectInput): Promise<Project | null> => {
        setOperationError(null);
        try {
            const createdProject = await projectService.createProject(input);
            projectsMutationVersionRef.current += 1;
            applyProjects([...projectsRef.current, createdProject].sort(compareProjectNames));
            selectProject(createdProject.projectId);
            void refreshProjects({ quiet: true });
            return createdProject;
        } catch (error) {
            console.error('Could not create the project.', error);
            setOperationError(CREATE_ERROR_MESSAGE);
            return null;
        }
    }, [applyProjects, refreshProjects, selectProject]);

    const updateProject = useCallback(async (projectId: string, input: ProjectInput): Promise<boolean> => {
        setOperationError(null);
        try {
            const updatedProject = await projectService.updateProject(projectId, input);
            projectsMutationVersionRef.current += 1;
            applyProjects(projectsRef.current.map(project => (
                project.projectId === projectId ? updatedProject : project
            )));
            return true;
        } catch (error) {
            console.error(`Could not update project ${projectId}.`, error);
            setOperationError(SAVE_ERROR_MESSAGE);
            return false;
        }
    }, [applyProjects]);

    const deleteProject = useCallback(async (projectId: string): Promise<boolean> => {
        setOperationError(null);
        const removedIndex = projectsRef.current.findIndex(project => project.projectId === projectId);
        try {
            await projectService.deleteProject(projectId);
            projectsMutationVersionRef.current += 1;
            const remainingProjects = projectsRef.current.filter(project => project.projectId !== projectId);
            applyProjects(remainingProjects);
            setTasksByProject(current => omitProjectTasks(current, projectId));
            if (selectedProjectIdRef.current === projectId) {
                const nextProject = remainingProjects[Math.min(Math.max(removedIndex, 0), remainingProjects.length - 1)] ?? null;
                selectProject(nextProject?.projectId ?? null);
            }
            return true;
        } catch (error) {
            console.error(`Could not delete project ${projectId}.`, error);
            setOperationError(DELETE_ERROR_MESSAGE);
            return false;
        }
    }, [applyProjects, selectProject]);

    const adjustProjectCounts = useCallback((projectId: string, taskDelta: number, completedDelta: number) => {
        if (taskDelta === 0 && completedDelta === 0) return;
        projectsMutationVersionRef.current += 1;
        applyProjects(projectsRef.current.map(project => project.projectId === projectId
            ? {
                ...project,
                taskCount: Math.max(0, project.taskCount + taskDelta),
                completedTaskCount: Math.max(0, project.completedTaskCount + completedDelta),
            }
            : project));
    }, [applyProjects]);

    const syncProjectCounts = useCallback(() => {
        invalidateResource('tasks');
        void refreshProjects({ quiet: true });
    }, [refreshProjects]);

    const forgetInFlightProjectTaskLoad = useCallback((projectId: string) => {
        taskLoadVersionsRef.current.set(projectId, (taskLoadVersionsRef.current.get(projectId) ?? 0) + 1);
        setTasksLoadingProjectId(current => current === projectId ? null : current);
    }, []);

    const replaceProjectTask = useCallback((projectId: string, task: Task) => {
        forgetInFlightProjectTaskLoad(projectId);
        setTasksByProject(current => {
            const tasks = current[projectId];
            if (!tasks) return current;
            const index = tasks.findIndex(candidate => candidate.taskId === task.taskId);
            if (index === -1) return { ...current, [projectId]: [task, ...tasks] };
            const nextTasks = [...tasks];
            nextTasks[index] = task;
            return { ...current, [projectId]: nextTasks };
        });
    }, [forgetInFlightProjectTaskLoad]);

    const removeProjectTask = useCallback((projectId: string, taskId: string) => {
        forgetInFlightProjectTaskLoad(projectId);
        setTasksByProject(current => {
            const tasks = current[projectId];
            if (!tasks || !tasks.some(task => task.taskId === taskId)) return current;
            return { ...current, [projectId]: tasks.filter(task => task.taskId !== taskId) };
        });
    }, [forgetInFlightProjectTaskLoad]);

    const beginQuickAdd = useCallback((): number => {
        quickAddSequenceRef.current += 1;
        return quickAddSequenceRef.current;
    }, []);

    const insertQuickAddedTask = useCallback((projectId: string, task: Task, sequence: number) => {
        quickAddOrderRef.current.set(task.taskId, sequence);
        forgetInFlightProjectTaskLoad(projectId);
        setTasksByProject(current => {
            const tasks = current[projectId] ?? [];
            let index = 0;
            while (index < tasks.length && (quickAddOrderRef.current.get(tasks[index].taskId) ?? 0) > sequence) {
                index += 1;
            }
            return { ...current, [projectId]: [...tasks.slice(0, index), task, ...tasks.slice(index)] };
        });
    }, [forgetInFlightProjectTaskLoad]);

    const selectedProject = useMemo(
        () => projects.find(project => project.projectId === selectedProjectId) ?? projects[0] ?? null,
        [projects, selectedProjectId],
    );

    const selectedProjectTasks = selectedProjectId ? tasksByProject[selectedProjectId] ?? [] : [];
    const tasksLoading = selectedProjectId !== null && tasksLoadingProjectId === selectedProjectId;

    return {
        projects,
        selectedProject,
        selectedProjectId,
        selectedProjectTasks,
        loading,
        tasksLoading,
        loadError,
        operationError,
        reload: () => void refreshProjects(),
        clearOperationError: () => setOperationError(null),
        showOperationError: (message: string) => setOperationError(message),
        selectProject,
        createProject,
        updateProject,
        deleteProject,
        adjustProjectCounts,
        syncProjectCounts,
        replaceProjectTask,
        removeProjectTask,
        beginQuickAdd,
        insertQuickAddedTask,
    };
}
