import { useEffect, useState, type MouseEvent } from 'react';
import {
    Box,
    Button,
    CircularProgress,
    Collapse,
    LinearProgress,
    Stack,
    Typography,
} from '@mui/material';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import ExpandLessRoundedIcon from '@mui/icons-material/ExpandLessRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import { Project } from '../../types/Project';
import { Task } from '../../types/Task';
import { ProjectTaskRow } from './ProjectTaskRow';
import { GroupTaskInputRow } from '../task/GroupTaskInputRow';
import { formatScheduledDate, projectProgressPercent, summarizeProjectTasks } from './projectsPresentation';
import { ProjectIdentityIcon, projectAccent } from './projectAppearance';
import { TaskToCreate } from '../../types/TaskToCreate';

interface ProjectDetailProps {
    project: Project;
    tasks: Task[];
    tasksLoading: boolean;
    editRequest: { taskId: string; requestId: number } | null;
    onEdit: () => void;
    onAddTask: (task: TaskToCreate) => Promise<boolean>;
    onToggleTask: (task: Task) => void;
    onUpdateTask: (taskId: string, updates: Partial<Task>) => Promise<void>;
    onTaskContextMenu: (task: Task, event: MouseEvent<HTMLElement>) => void;
}

export function ProjectDetail({
    project,
    tasks,
    tasksLoading,
    editRequest,
    onEdit,
    onAddTask,
    onToggleTask,
    onUpdateTask,
    onTaskContextMenu,
}: ProjectDetailProps) {
    const [completedExpanded, setCompletedExpanded] = useState(false);
    useEffect(() => setCompletedExpanded(false), [project.projectId]);
    const summary = summarizeProjectTasks(tasks);
    const openTasks = tasks.filter(task => !task.completed);
    const completedTasks = tasks.filter(task => task.completed);

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, textAlign: 'left' }}>
            <Box sx={{ px: { xs: 2, md: 3 }, py: 2, borderBottom: 1, borderColor: 'divider' }}>
                <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
                    <Stack direction="row" alignItems="center" spacing={1.25} sx={{ minWidth: 0 }}>
                        <ProjectIdentityIcon color={project.color} icon={project.icon} size={40} />
                        <Box sx={{ minWidth: 0 }}>
                            <Typography variant="h6" fontWeight={700} noWrap>{project.name}</Typography>
                            {project.description && (
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>
                                    {project.description}
                                </Typography>
                            )}
                        </Box>
                    </Stack>
                    <Button
                        size="small"
                        startIcon={<EditRoundedIcon />}
                        onClick={onEdit}
                        sx={{ flexShrink: 0, color: 'text.secondary' }}
                    >
                        Edit
                    </Button>
                </Stack>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1.5 }}>
                    <LinearProgress
                        variant="determinate"
                        value={projectProgressPercent(project)}
                        aria-label={`${project.completedTaskCount} of ${project.taskCount} tasks completed`}
                        sx={theme => ({
                            flex: 1,
                            height: 6,
                            borderRadius: 3,
                            bgcolor: 'action.hover',
                            '& .MuiLinearProgress-bar': { bgcolor: projectAccent(theme, project.color) },
                        })}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                        {project.completedTaskCount} of {project.taskCount} tasks completed
                    </Typography>
                </Stack>
                <Box sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                    gap: 1,
                    mt: 1.5,
                }}>
                    <Box sx={{ minWidth: 0, p: 1, border: 1, borderColor: 'divider', borderRadius: 2, bgcolor: 'background.default' }}>
                        <Typography variant="caption" color="text.secondary">Open</Typography>
                        <Typography variant="h6" fontWeight={700} lineHeight={1.2}>{summary.openCount}</Typography>
                    </Box>
                    <Box sx={{ minWidth: 0, p: 1, border: 1, borderColor: 'divider', borderRadius: 2, bgcolor: 'background.default' }}>
                        <Typography variant="caption" color="text.secondary">Overdue</Typography>
                        <Typography variant="h6" fontWeight={700} lineHeight={1.2} color={summary.overdueCount > 0 ? 'error.main' : 'text.primary'}>
                            {summary.overdueCount}
                        </Typography>
                    </Box>
                    <Box sx={{ minWidth: 0, p: 1, border: 1, borderColor: 'divider', borderRadius: 2, bgcolor: 'background.default' }}>
                        <Typography variant="caption" color="text.secondary">Next due</Typography>
                        <Typography variant="body2" fontWeight={700} noWrap>
                            {summary.nextDueTask ? formatScheduledDate(summary.nextDueTask.scheduledPerformDateTime) : 'None'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap component="div">
                            {summary.nextDueTask?.name ?? 'No scheduled tasks'}
                        </Typography>
                    </Box>
                </Box>
            </Box>

            <Box sx={{ px: 1, py: 0.5 }}>
                <GroupTaskInputRow
                    key={project.projectId}
                    contextName={project.name}
                    placeholder="Add a task to this project"
                    maxLength={200}
                    autoFocus={false}
                    onSubmit={task => { void onAddTask(task); }}
                />
            </Box>

            {tasksLoading ? (
                <Box sx={{ display: 'grid', placeItems: 'center', p: 4 }}>
                    <CircularProgress size={28} aria-label="Loading project tasks" />
                </Box>
            ) : tasks.length === 0 ? null : (
                <Box>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, pt: 1.25, pb: 0.5 }}>
                        <Typography variant="subtitle2" fontWeight={700}>To do</Typography>
                        <Typography variant="caption" color="text.secondary">{openTasks.length}</Typography>
                    </Stack>
                    {openTasks.length === 0 ? (
                        <Box sx={{ px: 2, py: 1.5 }}>
                            <Typography variant="body2" color="text.secondary">
                                All tasks are complete.
                            </Typography>
                        </Box>
                    ) : openTasks.map(task => (
                        <ProjectTaskRow
                            key={task.taskId}
                            task={task}
                            editRequestId={editRequest?.taskId === task.taskId ? editRequest.requestId : null}
                            onToggle={onToggleTask}
                            onUpdate={onUpdateTask}
                            onContextMenu={onTaskContextMenu}
                        />
                    ))}
                    {completedTasks.length > 0 && (
                        <>
                            <Button
                                fullWidth
                                size="small"
                                onClick={() => setCompletedExpanded(current => !current)}
                                aria-expanded={completedExpanded}
                                startIcon={completedExpanded ? <ExpandLessRoundedIcon /> : <ExpandMoreRoundedIcon />}
                                sx={{
                                    justifyContent: 'flex-start',
                                    px: 2,
                                    py: 1,
                                    borderTop: 1,
                                    borderColor: 'divider',
                                    borderRadius: 0,
                                    color: 'text.secondary',
                                    textAlign: 'left',
                                }}
                            >
                                Completed ({completedTasks.length})
                            </Button>
                            <Collapse in={completedExpanded}>
                                {completedTasks.map(task => (
                                    <ProjectTaskRow
                                        key={task.taskId}
                                        task={task}
                                        editRequestId={editRequest?.taskId === task.taskId ? editRequest.requestId : null}
                                        onToggle={onToggleTask}
                                        onUpdate={onUpdateTask}
                                        onContextMenu={onTaskContextMenu}
                                    />
                                ))}
                            </Collapse>
                        </>
                    )}
                </Box>
            )}
        </Box>
    );
}
