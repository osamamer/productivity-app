import { useRef, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Menu,
    MenuItem,
    Popover,
    Snackbar,
    Stack,
    Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import FolderOpenRoundedIcon from '@mui/icons-material/FolderOpenRounded';
import { PageWrapper } from '../components/PageWrapper';
import { ProjectDetail } from '../components/projects/ProjectDetail';
import { ProjectFormDialog } from '../components/projects/ProjectFormDialog';
import { ProjectList } from '../components/projects/ProjectList';
import { useGlobalTasks } from '../hooks/useGlobalTasks';
import { useProjectsWorkspace } from '../hooks/useProjectsWorkspace';
import { taskService } from '../services/api/taskService';
import { playAudioFeedback } from '../services/audioFeedback';
import { Project, ProjectInput } from '../types/Project';
import { Task } from '../types/Task';

type ProjectMenuRequest = { project: Project; anchorEl: HTMLElement };

export function ProjectsPage() {
    const { allTasks, addTaskToState, updateTaskInState } = useGlobalTasks();
    const {
        projects,
        selectedProject,
        selectedProjectId,
        selectedProjectTasks,
        loading,
        tasksLoading,
        loadError,
        operationError,
        reload,
        clearOperationError,
        showOperationError,
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
    } = useProjectsWorkspace();
    const [formOpen, setFormOpen] = useState(false);
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [menuRequest, setMenuRequest] = useState<ProjectMenuRequest | null>(null);
    const [deleteRequest, setDeleteRequest] = useState<ProjectMenuRequest | null>(null);
    const [deleteSubmitting, setDeleteSubmitting] = useState(false);
    const [pendingUnassignIds, setPendingUnassignIds] = useState<ReadonlySet<string>>(new Set());
    const toggleVersionsRef = useRef(new Map<string, number>());
    const unassignInFlightRef = useRef(new Set<string>());

    const openCreateForm = () => {
        setEditingProject(null);
        setFormOpen(true);
    };

    const openEditForm = () => {
        if (!selectedProject) return;
        setEditingProject(selectedProject);
        setFormOpen(true);
    };

    const handleSaveProject = async (input: ProjectInput) => {
        if (editingProject) return updateProject(editingProject.projectId, input);
        return Boolean(await createProject(input));
    };

    const handleAddTask = async (name: string): Promise<boolean> => {
        if (!selectedProject) return false;
        const projectId = selectedProject.projectId;
        const sequence = beginQuickAdd();
        try {
            const createdTask = await taskService.createTask({
                name,
                description: '',
                scheduledPerformDateTime: '',
                tag: '',
                importance: 0,
                projectId,
            });
            addTaskToState(createdTask);
            insertQuickAddedTask(projectId, createdTask, sequence);
            adjustProjectCounts(projectId, 1, 0);
            syncProjectCounts();
            return true;
        } catch (error) {
            console.error('Could not add the task to the project.', error);
            showOperationError('Could not add the task.');
            return false;
        }
    };

    const handleToggleTask = async (task: Task) => {
        const projectId = task.projectId;
        if (!projectId) return;

        const version = (toggleVersionsRef.current.get(task.taskId) ?? 0) + 1;
        toggleVersionsRef.current.set(task.taskId, version);
        const nextCompleted = !task.completed;

        updateTaskInState(task.taskId, { completed: nextCompleted });
        replaceProjectTask(projectId, { ...task, completed: nextCompleted });
        adjustProjectCounts(projectId, 0, nextCompleted ? 1 : -1);

        try {
            const updatedTask = await taskService.updateTask(task.taskId, { completed: nextCompleted });
            if (toggleVersionsRef.current.get(task.taskId) !== version) return;
            updateTaskInState(task.taskId, updatedTask);
            replaceProjectTask(projectId, updatedTask);
            syncProjectCounts();
            if (nextCompleted) playAudioFeedback('taskCompleted');
        } catch (error) {
            console.error(`Could not update task ${task.taskId}.`, error);
            if (toggleVersionsRef.current.get(task.taskId) !== version) return;
            updateTaskInState(task.taskId, task);
            replaceProjectTask(projectId, task);
            adjustProjectCounts(projectId, 0, nextCompleted ? -1 : 1);
            showOperationError('Could not update the task.');
        }
    };

    const handleUnassignTask = async (task: Task) => {
        const projectId = task.projectId;
        if (!projectId || unassignInFlightRef.current.has(task.taskId)) return;

        unassignInFlightRef.current.add(task.taskId);
        setPendingUnassignIds(current => new Set(current).add(task.taskId));
        try {
            const updatedTask = await taskService.updateTask(task.taskId, { projectId: null });
            updateTaskInState(task.taskId, updatedTask);
            removeProjectTask(projectId, task.taskId);
            adjustProjectCounts(projectId, -1, task.completed ? -1 : 0);
            syncProjectCounts();
        } catch (error) {
            console.error(`Could not remove task ${task.taskId} from its project.`, error);
            showOperationError('Could not remove the task from this project.');
        } finally {
            unassignInFlightRef.current.delete(task.taskId);
            setPendingUnassignIds(current => {
                const next = new Set(current);
                next.delete(task.taskId);
                return next;
            });
        }
    };

    const requestProjectDelete = () => {
        if (!menuRequest) return;
        setDeleteRequest(menuRequest);
        setMenuRequest(null);
    };

    const handleDeleteProject = async () => {
        if (!deleteRequest || deleteSubmitting) return;
        const project = deleteRequest.project;
        setDeleteSubmitting(true);
        const deleted = await deleteProject(project.projectId);
        setDeleteSubmitting(false);
        setDeleteRequest(null);
        if (!deleted) return;

        const unassignedTasks = allTasks
            .filter(task => task.projectId === project.projectId)
            .map(task => ({ ...task, projectId: null }));
        if (unassignedTasks.length > 0) {
            // The server clears projectId on these tasks, so refresh the cached
            // task snapshots instead of waiting for their TTL.
            taskService.cacheMainTasks(unassignedTasks);
        }
        unassignedTasks.forEach(task => updateTaskInState(task.taskId, { projectId: null }));
    };

    return (
        <PageWrapper>
            <Box sx={{
                width: '100%',
                maxWidth: 1500,
                mx: 'auto',
                flex: 1,
                minWidth: 0,
                height: '100%',
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
            }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2} sx={{ mb: 1, flexShrink: 0 }}>
                    <Box sx={{ textAlign: 'left' }}>
                        <Typography variant="h6" fontWeight={720}>Projects</Typography>
                        <Typography variant="caption" color="text.secondary">
                            Group related tasks and follow progress at a glance.
                        </Typography>
                    </Box>
                    <Button
                        size="small"
                        variant="outlined"
                        startIcon={<AddRoundedIcon />}
                        onClick={openCreateForm}
                        sx={{
                            flexShrink: 0,
                            color: 'text.secondary',
                            borderColor: 'divider',
                            '&:hover': {
                                color: 'primary.main',
                                borderColor: 'primary.main',
                            },
                        }}
                    >
                        New project
                    </Button>
                </Stack>

                {loading && projects.length === 0 ? (
                    <Box sx={{ flex: 1, display: 'grid', placeItems: 'center' }}>
                        <CircularProgress aria-label="Loading projects" />
                    </Box>
                ) : loadError && projects.length === 0 ? (
                    <Alert
                        severity="error"
                        action={<Button color="inherit" size="small" onClick={reload}>Retry</Button>}
                    >
                        {loadError}
                    </Alert>
                ) : projects.length === 0 ? (
                    <Box sx={{
                        flex: 1,
                        display: 'grid',
                        placeItems: 'center',
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 3,
                        bgcolor: 'background.paper',
                    }}>
                        <Box sx={{ maxWidth: 400, textAlign: 'center', p: 4 }}>
                            <FolderOpenRoundedIcon color="primary" sx={{ fontSize: 52, opacity: 0.75 }} />
                            <Typography variant="h6" fontWeight={700} sx={{ mt: 1 }}>
                                No projects yet
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                                Group related tasks and watch the progress add up.
                            </Typography>
                            <Button
                                variant="contained"
                                startIcon={<AddRoundedIcon />}
                                onClick={openCreateForm}
                                sx={{ mt: 2 }}
                            >
                                New project
                            </Button>
                        </Box>
                    </Box>
                ) : (
                    <Box sx={{
                        mt: 1.5,
                        flex: 1,
                        minHeight: 0,
                        display: 'grid',
                        gridTemplateRows: 'minmax(0, 1fr)',
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 3,
                        bgcolor: 'background.paper',
                        overflow: 'hidden',
                    }}>
                        <Box sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', md: 'minmax(300px, 380px) minmax(0, 1fr)' },
                            gridTemplateRows: { xs: 'minmax(0, 1fr) minmax(0, 1fr)', md: 'minmax(0, 1fr)' },
                            minHeight: 0,
                            overflow: 'hidden',
                            bgcolor: 'background.default',
                        }}>
                            <Box sx={{
                                minHeight: 0,
                                overflowY: 'auto',
                                bgcolor: 'background.default',
                                borderRightWidth: { xs: 0, md: 1 },
                                borderRightStyle: 'solid',
                                borderRightColor: 'divider',
                                borderBottomWidth: { xs: 1, md: 0 },
                                borderBottomStyle: 'solid',
                                borderBottomColor: 'divider',
                            }}>
                                <ProjectList
                                    projects={projects}
                                    selectedId={selectedProjectId}
                                    onSelect={selectProject}
                                    onOpenMenu={(project, anchorEl) => {
                                        selectProject(project.projectId);
                                        setMenuRequest({ project, anchorEl });
                                    }}
                                />
                            </Box>
                            {selectedProject ? (
                                <Box sx={{ minWidth: 0, minHeight: 0, overflowY: 'auto', bgcolor: 'background.default' }}>
                                    <ProjectDetail
                                        project={selectedProject}
                                        tasks={selectedProjectTasks}
                                        tasksLoading={tasksLoading}
                                        pendingUnassignIds={pendingUnassignIds}
                                        onEdit={openEditForm}
                                        onAddTask={handleAddTask}
                                        onToggleTask={task => void handleToggleTask(task)}
                                        onUnassignTask={task => void handleUnassignTask(task)}
                                    />
                                </Box>
                            ) : (
                                <Box sx={{ display: 'grid', placeItems: 'center', p: 4, bgcolor: 'background.default' }}>
                                    <Typography variant="body2" color="text.secondary">
                                        Select a project to see its tasks.
                                    </Typography>
                                </Box>
                            )}
                        </Box>
                    </Box>
                )}
            </Box>

            <ProjectFormDialog
                open={formOpen}
                project={editingProject}
                onClose={() => setFormOpen(false)}
                onSave={handleSaveProject}
            />

            <Menu
                open={menuRequest !== null}
                anchorEl={menuRequest?.anchorEl}
                onClose={() => setMenuRequest(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
                <MenuItem onClick={requestProjectDelete}>
                    <DeleteOutlineRoundedIcon fontSize="small" sx={{ mr: 1 }} />
                    Delete
                </MenuItem>
            </Menu>

            <Popover
                open={deleteRequest !== null}
                anchorEl={deleteRequest?.anchorEl}
                onClose={() => {
                    if (!deleteSubmitting) setDeleteRequest(null);
                }}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                slotProps={{
                    paper: {
                        sx: {
                            p: 1.5,
                            width: 300,
                            maxWidth: 'calc(100vw - 32px)',
                            borderRadius: 2.5,
                        },
                    },
                }}
            >
                {deleteRequest && (
                    <Box>
                        <Typography variant="body2" sx={{ mb: 1.25 }}>
                            Delete “{deleteRequest.project.name}”? Its tasks will stay in Tasks without a project.
                        </Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.75 }}>
                            <Button size="small" onClick={() => setDeleteRequest(null)} disabled={deleteSubmitting}>
                                Cancel
                            </Button>
                            <Button
                                size="small"
                                color="error"
                                variant="contained"
                                onClick={() => void handleDeleteProject()}
                                disabled={deleteSubmitting}
                            >
                                {deleteSubmitting ? <CircularProgress size={16} color="inherit" /> : 'Delete'}
                            </Button>
                        </Box>
                    </Box>
                )}
            </Popover>

            <Snackbar
                open={Boolean(operationError)}
                autoHideDuration={5000}
                onClose={clearOperationError}
                message={operationError}
            />
        </PageWrapper>
    );
}
