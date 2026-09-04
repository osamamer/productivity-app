import { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Menu,
    MenuItem,
    Popover,
    Snackbar,
    Stack,
    Typography,
    Skeleton,
    alpha,
} from '@mui/material';
import { keyframes } from '@mui/system';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import PsychologyIcon from '@mui/icons-material/Psychology';
import { BackToMentalButton } from '../components/BackToMentalButton';
import { PageWrapper } from '../components/PageWrapper.tsx';
import { MentalThreadList } from '../components/mental-threads/MentalThreadList.tsx';
import { MentalThreadDetail } from '../components/mental-threads/MentalThreadDetail.tsx';
import { MentalThreadCreateDialog } from '../components/mental-threads/MentalThreadCreateDialog.tsx';
import { CloseMentalThreadDialog } from '../components/mental-threads/CloseMentalThreadDialog.tsx';
import {
    attentionStateDetails,
    attentionStates,
    closedThreadColor,
} from '../components/mental-threads/mentalThreadPresentation.ts';
import { useMentalThreadsWorkspace } from '../hooks/useMentalThreadsWorkspace.ts';
import { useGlobalTasks } from '../hooks/useGlobalTasks';
import { taskService } from '../services/api/taskService.ts';
import { Task } from '../types/Task.tsx';
import { TaskToCreate } from '../types/TaskToCreate.tsx';
import {
    AttentionState,
    CloseMentalThreadInput,
    MentalThread,
    MentalThreadInput,
} from '../types/MentalThread.ts';
import { getShowClosedMentalThreads } from '../services/utils/mentalThreadPreferences.ts';
import { playAudioFeedback } from '../services/audioFeedback.ts';

type StateFilter = AttentionState | 'ALL';
type ThreadActionRequest = { thread: MentalThread; anchorEl: HTMLElement };

const loadingTemplateReveal = keyframes`
    from {
        opacity: 0;
        transform: translate3d(0, 8px, 0);
    }
    to {
        opacity: 1;
        transform: none;
    }
`;

const loadingBlockReveal = keyframes`
    from {
        opacity: 0;
        transform: translate3d(0, 5px, 0);
    }
    to {
        opacity: 1;
        transform: none;
    }
`;

const loadedWorkspaceReveal = keyframes`
    from {
        opacity: 0;
        transform: translate3d(0, 8px, 0);
    }
    to {
        opacity: 1;
        transform: none;
    }
`;

function StateFilterChip({ stateFilter, onChange }: { stateFilter: StateFilter; onChange: (state: StateFilter) => void }) {
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const color = stateFilter === 'ALL' ? closedThreadColor : attentionStateDetails[stateFilter].color;
    const label = stateFilter === 'ALL' ? 'All Threads' : `${attentionStateDetails[stateFilter].label} Threads`;

    const selectState = (state: StateFilter) => {
        setAnchorEl(null);
        onChange(state);
    };

    return (
        <>
            <Chip
                size="medium"
                clickable
                onClick={event => setAnchorEl(event.currentTarget)}
                label={label}
                sx={{
                    flexShrink: 0,
                    minHeight: 36,
                    px: 0.5,
                    color,
                    bgcolor: alpha(color, 0.1),
                    fontWeight: 700,
                }}
                aria-label="Filter mental threads by attention state"
                aria-haspopup="menu"
                aria-expanded={Boolean(anchorEl)}
            />
            <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
                <MenuItem selected={stateFilter === 'ALL'} onClick={() => selectState('ALL')}>
                    <Box component="span" sx={{ width: 9, height: 9, mr: 1, borderRadius: '50%', bgcolor: closedThreadColor }} />
                    All Threads
                </MenuItem>
                {attentionStates.map(state => (
                    <MenuItem key={state} selected={state === stateFilter} onClick={() => selectState(state)}>
                        <Box component="span" sx={{ width: 9, height: 9, mr: 1, borderRadius: '50%', bgcolor: attentionStateDetails[state].color }} />
                        {attentionStateDetails[state].label} Threads
                    </MenuItem>
                ))}
            </Menu>
        </>
    );
}

function MentalThreadsLoadingState() {
    return (
        <Box sx={{
            mt: 1.5,
            flex: 1,
            minHeight: 0,
            display: 'grid',
            gridTemplateRows: 'auto minmax(0, 1fr)',
            border: 1,
            borderColor: 'divider',
            borderRadius: 3,
            bgcolor: 'background.paper',
            overflow: 'hidden',
            animation: `${loadingTemplateReveal} 420ms cubic-bezier(0.22, 1, 0.36, 1) both`,
            '@media (prefers-reduced-motion: reduce)': {
                animation: 'none',
                '& .MuiSkeleton-root': { animation: 'none' },
            },
        }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2} sx={{ px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider' }}>
                <Skeleton animation="wave" variant="rounded" width={150} height={36} />
            </Stack>
            <Box sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'minmax(320px, 420px) minmax(0, 1fr)' },
                gridTemplateRows: { xs: 'minmax(0, 1fr) minmax(0, 1fr)', md: 'minmax(0, 1fr)' },
                minHeight: 0,
            }}>
                <Stack spacing={1} sx={{ p: 1.5, bgcolor: 'background.default', borderRight: { md: 1 }, borderBottom: { xs: 1, md: 0 }, borderColor: 'divider' }}>
                    {[0, 1, 2, 3].map(item => (
                        <Box key={item} sx={{
                            p: 1.25,
                            borderRadius: 2,
                            bgcolor: 'background.paper',
                            animation: `${loadingBlockReveal} 360ms cubic-bezier(0.22, 1, 0.36, 1) ${item * 45}ms both`,
                            '@media (prefers-reduced-motion: reduce)': {
                                animation: 'none',
                                '& .MuiSkeleton-root': { animation: 'none' },
                            },
                        }}>
                            <Skeleton animation="wave" variant="text" width={`${58 + item * 7}%`} />
                            <Skeleton animation="wave" variant="rounded" height={6} sx={{ mt: 1 }} />
                        </Box>
                    ))}
                </Stack>
                <Stack spacing={1.5} sx={{
                    p: { xs: 2, md: 3 },
                    animation: `${loadingBlockReveal} 420ms cubic-bezier(0.22, 1, 0.36, 1) 120ms both`,
                    '@media (prefers-reduced-motion: reduce)': {
                        animation: 'none',
                        '& .MuiSkeleton-root': { animation: 'none' },
                    },
                }}>
                    <Skeleton animation="wave" variant="text" width="42%" height={34} />
                    <Skeleton animation="wave" variant="text" width="88%" />
                    <Skeleton animation="wave" variant="rounded" height={10} />
                    <Skeleton animation="wave" variant="text" width="70%" />
                </Stack>
            </Box>
        </Box>
    );
}

export function MentalThreadsPage() {
    const {
        allTasks,
        addTaskToState,
        updateTaskInState,
        removeTaskFromState,
    } = useGlobalTasks();
    const {
        threads,
        summary,
        loading,
        error,
        operationError,
        reload,
        clearOperationError,
        createThread,
        updateThread,
        closeThread,
        reopenThread,
        deleteThread,
    } = useMentalThreadsWorkspace();
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [showClosed] = useState(getShowClosedMentalThreads);
    const [stateFilter, setStateFilter] = useState<StateFilter>('ALL');
    const [formOpen, setFormOpen] = useState(false);
    const [closingThread, setClosingThread] = useState<MentalThread | null>(null);
    const [threadMenu, setThreadMenu] = useState<ThreadActionRequest | null>(null);
    const [deleteRequest, setDeleteRequest] = useState<ThreadActionRequest | null>(null);
    const [deleteSubmitting, setDeleteSubmitting] = useState(false);

    const visibleThreads = useMemo(() => threads.filter(thread => {
        if (!showClosed && thread.status === 'CLOSED') return false;
        return stateFilter === 'ALL' || thread.attentionState === stateFilter;
    }), [showClosed, stateFilter, threads]);

    const selectedThread = useMemo(
        // Use the first visible thread during the render where the list arrives.
        // Waiting for the selection effect would briefly show the empty detail pane.
        () => visibleThreads.find(thread => thread.id === selectedId) ?? visibleThreads[0] ?? null,
        [selectedId, visibleThreads],
    );
    const selectedThreadTasks = useMemo(
        () => selectedThread
            ? allTasks.filter(task => task.mentalThreadId === selectedThread.id)
            : [],
        [allTasks, selectedThread],
    );

    useEffect(() => {
        const selectedThreadStillVisible = visibleThreads.some(thread => thread.id === selectedId);
        if (!selectedThreadStillVisible) setSelectedId(visibleThreads[0]?.id ?? null);
    }, [selectedId, visibleThreads]);

    const handleCreate = async (input: MentalThreadInput) => {
        const created = await createThread(input);
        if (created) {
            setSelectedId(created.id);
            playAudioFeedback('mentalThreadCreated');
        }
        return Boolean(created);
    };

    const handleClose = async (input: CloseMentalThreadInput) => {
        if (!closingThread) return false;
        return Boolean(await closeThread(closingThread.id, input));
    };

    const handleReopen = async () => {
        if (!selectedThread) return;
        await reopenThread(selectedThread.id);
    };

    const handleSelectThread = (threadId: string) => {
        setThreadMenu(null);
        setSelectedId(threadId);
    };

    const handleThreadContextMenu = (thread: MentalThread, anchorEl: HTMLElement) => {
        setSelectedId(thread.id);
        setThreadMenu({ thread, anchorEl });
    };

    const requestThreadDelete = () => {
        if (!threadMenu) return;
        setDeleteRequest(threadMenu);
        setThreadMenu(null);
    };

    const closeDeleteRequest = () => {
        if (!deleteSubmitting) setDeleteRequest(null);
    };

    const handleDelete = async () => {
        if (!deleteRequest || deleteSubmitting) return;
        const request = deleteRequest;
        setDeleteSubmitting(true);
        setDeleteRequest(null);
        try {
            const deleted = await deleteThread(request.thread.id);
            if (deleted) setSelectedId(null);
        } finally {
            setDeleteSubmitting(false);
        }
    };

    const handleCreateTask = async (task: TaskToCreate): Promise<Task> => {
        if (!selectedThread) throw new Error('No mental thread is selected.');
        const createdTask = await taskService.createTask({
            ...task,
            mentalThreadId: selectedThread.id,
        });
        addTaskToState(createdTask);
        return createdTask;
    };

    const handleToggleTask = async (task: Task) => {
        const nextCompleted = !task.completed;
        updateTaskInState(task.taskId, { completed: nextCompleted });
        try {
            const updated = await taskService.updateTask(task.taskId, { completed: nextCompleted });
            updateTaskInState(task.taskId, updated);
            if (!task.completed && updated.completed) playAudioFeedback('taskCompleted');
        } catch (error) {
            updateTaskInState(task.taskId, task);
            throw error;
        }
    };

    const handleUpdateTask = async (taskId: string, updates: Partial<Task>) => {
        const previous = allTasks.find(task => task.taskId === taskId);
        updateTaskInState(taskId, updates);
        try {
            const updated = await taskService.updateTask(taskId, updates);
            updateTaskInState(taskId, updated);
        } catch (error) {
            if (previous) updateTaskInState(taskId, previous);
            throw error;
        }
    };

    const handleDeleteTask = async (task: Task) => {
        await taskService.deleteTask(task.taskId);
        removeTaskFromState(task.taskId);
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
                <BackToMentalButton />
                <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 1, flexShrink: 0 }}>
                    <Box sx={{ textAlign: 'left' }}>
                        <Typography variant="h6" fontWeight={720}>Mental threads</Typography>
                        <Typography variant="caption" color="text.secondary">
                            See what is occupying attention, contain it, and notice when the load changes.
                        </Typography>
                    </Box>
                </Stack>

                {loading && !summary ? (
                    <MentalThreadsLoadingState />
                ) : error ? (
                    <Alert
                        severity="error"
                        action={<Button color="inherit" size="small" onClick={() => void reload()}>Retry</Button>}
                    >
                        {error}
                    </Alert>
                ) : summary && (<>
                    <Box sx={{
                        mt: 1.5,
                        flex: 1,
                        minHeight: 0,
                        display: 'grid',
                        gridTemplateRows: 'auto minmax(0, 1fr)',
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 3,
                        bgcolor: 'background.paper',
                        overflow: 'hidden',
                        animation: `${loadedWorkspaceReveal} 420ms cubic-bezier(0.22, 1, 0.36, 1) both`,
                        '@media (prefers-reduced-motion: reduce)': {
                            animation: 'none',
                        },
                    }}>
                        <Stack
                            direction="row"
                            alignItems="center"
                            justifyContent="space-between"
                            spacing={1.5}
                            sx={{ px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider' }}
                        >
                            <StateFilterChip stateFilter={stateFilter} onChange={setStateFilter} />
                            <Button
                                size="small"
                                variant="outlined"
                                startIcon={<AddRoundedIcon />}
                                onClick={() => setFormOpen(true)}
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
                                New thread
                            </Button>
                        </Stack>

                        <Box sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', md: 'minmax(320px, 420px) minmax(0, 1fr)' },
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
                                <MentalThreadList
                                    threads={visibleThreads}
                                    selectedId={selectedId}
                                    onSelect={handleSelectThread}
                                    onContextMenu={handleThreadContextMenu}
                                />
                            </Box>
                            {selectedThread ? (
                                <Box sx={{ minWidth: 0, minHeight: 0, overflowY: 'auto', bgcolor: 'background.default' }}>
                                    <MentalThreadDetail
                                        thread={selectedThread}
                                        onSave={input => updateThread(selectedThread.id, input).then(Boolean)}
                                        onCloseThread={() => setClosingThread(selectedThread)}
                                        onReopen={() => void handleReopen()}
                                        tasks={selectedThreadTasks}
                                        onCreateTask={handleCreateTask}
                                        onToggleTask={handleToggleTask}
                                        onUpdateTask={handleUpdateTask}
                                        onDeleteTask={handleDeleteTask}
                                    />
                                </Box>
                            ) : (
                                <Box sx={{ display: 'grid', placeItems: 'center', p: 4, bgcolor: 'background.default' }}>
                                    <Box sx={{ maxWidth: 400, textAlign: 'center' }}>
                                        <PsychologyIcon color="primary" sx={{ fontSize: 52, opacity: 0.75 }} />
                                        <Typography variant="h6" fontWeight={700} sx={{ mt: 1 }}>
                                            What keeps resurfacing?
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                                            Capture it as a thread. You do not need to know the next action yet.
                                        </Typography>
                                    </Box>
                                </Box>
                            )}
                        </Box>
                    </Box>
                </>)}
            </Box>

            <MentalThreadCreateDialog
                open={formOpen}
                onClose={() => setFormOpen(false)}
                onSave={handleCreate}
            />
            <CloseMentalThreadDialog
                thread={closingThread}
                onClose={() => setClosingThread(null)}
                onConfirm={handleClose}
            />
            <Menu
                open={threadMenu !== null}
                anchorEl={threadMenu?.anchorEl}
                onClose={() => setThreadMenu(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
                <MenuItem onClick={requestThreadDelete}>
                    <DeleteOutlineRoundedIcon fontSize="small" sx={{ mr: 1 }} />
                    Delete
                </MenuItem>
            </Menu>
            <Popover
                open={deleteRequest !== null}
                anchorEl={deleteRequest?.anchorEl}
                onClose={closeDeleteRequest}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                slotProps={{
                    paper: {
                        sx: {
                            p: 1.5,
                            width: 280,
                            maxWidth: 'calc(100vw - 32px)',
                            borderRadius: 2.5,
                        },
                    },
                }}
            >
                {deleteRequest && (
                    <Box>
                        <Typography variant="body2" sx={{ mb: 1.25 }}>
                            Delete “{deleteRequest.thread.title}” and its load history? Connected tasks will remain in Tasks.
                        </Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.75 }}>
                            <Button size="small" onClick={closeDeleteRequest} disabled={deleteSubmitting}>Cancel</Button>
                            <Button
                                size="small"
                                color="error"
                                variant="contained"
                                onClick={() => void handleDelete()}
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
