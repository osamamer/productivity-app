import { useEffect, useRef, useState, type WheelEvent } from 'react';
import {
    Alert,
    Box,
    Button,
    Chip,
    Menu,
    MenuItem,
    Paper,
    Stack,
    Typography,
    alpha,
} from '@mui/material';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import { AttentionState, MentalThread, MentalThreadInput, MentalThreadLoadEntry } from '../../types/MentalThread.ts';
import { Task } from '../../types/Task.tsx';
import { TaskToCreate } from '../../types/TaskToCreate.tsx';
import { mentalThreadService } from '../../services/api/mentalThreadService.ts';
import {
    cacheMentalThreadHistory,
    getCachedMentalThreadHistory,
} from '../../services/cache/mentalThreadHistoryCache.ts';
import { ThreadTasksSection } from './ThreadTasksSection.tsx';
import { MentalThreadInlineEditor } from './MentalThreadInlineEditor.tsx';
import {
    attentionStateDetails,
    attentionStates,
    closedThreadColor,
    closureTypeLabels,
    resolvedThreadColor,
} from './mentalThreadPresentation.ts';

interface MentalThreadDetailProps {
    thread: MentalThread;
    onSave: (input: MentalThreadInput) => Promise<boolean>;
    onCloseThread: () => void;
    onReopen: () => void;
    tasks: Task[];
    onCreateTask: (task: TaskToCreate) => Promise<Task>;
    onToggleTask: (task: Task) => Promise<void>;
    onUpdateTask: (taskId: string, updates: Partial<Task>) => Promise<void>;
    onDeleteTask: (task: Task) => Promise<void>;
}

interface LoadHistoryState {
    threadId: string;
    mentalLoad: number;
    updatedAt: string;
    entries: MentalThreadLoadEntry[];
    loading: boolean;
    error: string | null;
}

function stateUpdateInput(thread: MentalThread, attentionState: AttentionState): MentalThreadInput {
    return {
        title: thread.title,
        description: thread.description,
        attentionState,
        desiredResolution: thread.desiredResolution,
        targetCloseDate: thread.targetCloseDate,
        hardDeadlineDate: thread.hardDeadlineDate,
        nextReviewDate: thread.nextReviewDate,
        currentMentalLoad: thread.currentMentalLoad,
        loadReason: null,
    };
}

function handleLoadHistoryWheel(event: WheelEvent<HTMLDivElement>): void {
    const history = event.currentTarget;
    if (history.scrollWidth <= history.clientWidth) return;

    history.scrollLeft += event.deltaX || event.deltaY;
    event.preventDefault();
    event.stopPropagation();
}

function MentalThreadStateChip({ thread, onSave }: { thread: MentalThread; onSave: MentalThreadDetailProps['onSave'] }) {
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const presentation = attentionStateDetails[thread.attentionState];

    const updateState = (attentionState: AttentionState) => {
        setAnchorEl(null);
        void onSave(stateUpdateInput(thread, attentionState));
    };

    return (
        <>
            <Chip
                size="medium"
                onClick={event => setAnchorEl(event.currentTarget)}
                label={presentation.label}
                sx={{
                    flexShrink: 0,
                    minHeight: 36,
                    px: 0.5,
                    color: presentation.color,
                    bgcolor: alpha(presentation.color, 0.1),
                    fontWeight: 700,
                }}
                aria-label="Change attention state"
            />
            <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
                {attentionStates.map(state => (
                    <MenuItem
                        key={state}
                        selected={state === thread.attentionState}
                        onClick={() => void updateState(state)}
                    >
                        <Box component="span" sx={{ width: 9, height: 9, mr: 1, borderRadius: '50%', bgcolor: attentionStateDetails[state].color }} />
                        {attentionStateDetails[state].label}
                    </MenuItem>
                ))}
            </Menu>
        </>
    );
}

export function MentalThreadDetail({
    thread,
    onSave,
    onCloseThread,
    onReopen,
    tasks,
    onCreateTask,
    onToggleTask,
    onUpdateTask,
    onDeleteTask,
}: MentalThreadDetailProps) {
    const [loadHistoryState, setLoadHistoryState] = useState<LoadHistoryState>(() => {
        const cached = getCachedMentalThreadHistory(thread.id);
        return cached?.mentalLoad === thread.currentMentalLoad
            && cached.updatedAt === thread.updatedAt
            ? {
                threadId: thread.id,
                mentalLoad: thread.currentMentalLoad,
                updatedAt: thread.updatedAt,
                entries: cached.entries,
                loading: false,
                error: null,
            }
            : {
                threadId: thread.id,
                mentalLoad: thread.currentMentalLoad,
                updatedAt: thread.updatedAt,
                entries: [],
                loading: true,
                error: null,
            };
    });
    const [showHistoryLoading, setShowHistoryLoading] = useState(false);
    const loadHistoryStateRef = useRef(loadHistoryState);
    loadHistoryStateRef.current = loadHistoryState;
    const threadUpdatedAtRef = useRef(thread.updatedAt);
    threadUpdatedAtRef.current = thread.updatedAt;
    const presentation = attentionStateDetails[thread.attentionState];
    const isClosed = thread.status === 'CLOSED';
    const isResolved = thread.status === 'CLOSED' && thread.closureType === 'RESOLVED';
    const currentStateColor = isResolved
        ? resolvedThreadColor
        : isClosed ? closedThreadColor : presentation.color;
    const cachedHistory = getCachedMentalThreadHistory(thread.id);
    const stateMatchesThread = loadHistoryState.threadId === thread.id;
    const visibleHistory: LoadHistoryState = stateMatchesThread
        ? loadHistoryState
        : cachedHistory?.mentalLoad === thread.currentMentalLoad
            && cachedHistory.updatedAt === thread.updatedAt
            ? {
                threadId: thread.id,
                mentalLoad: thread.currentMentalLoad,
                updatedAt: thread.updatedAt,
                entries: cachedHistory.entries,
                loading: false,
                error: null,
            }
            : {
                threadId: thread.id,
                mentalLoad: thread.currentMentalLoad,
                updatedAt: thread.updatedAt,
                entries: [],
                loading: true,
                error: null,
            };

    useEffect(() => {
        if (!visibleHistory.loading) {
            setShowHistoryLoading(false);
            return;
        }

        const timeoutId = window.setTimeout(() => setShowHistoryLoading(true), 200);
        return () => window.clearTimeout(timeoutId);
    }, [visibleHistory.loading, visibleHistory.threadId, visibleHistory.mentalLoad, visibleHistory.updatedAt]);

    useEffect(() => {
        const updatedAt = threadUpdatedAtRef.current;
        const cached = getCachedMentalThreadHistory(thread.id);
        if (cached?.mentalLoad === thread.currentMentalLoad && cached.updatedAt === updatedAt) {
            setLoadHistoryState({
                threadId: thread.id,
                mentalLoad: thread.currentMentalLoad,
                updatedAt,
                entries: cached.entries,
                loading: false,
                error: null,
            });
            return;
        }

        const controller = new AbortController();
        const existingEntries = loadHistoryStateRef.current.threadId === thread.id
            ? loadHistoryStateRef.current.entries
            : [];
        setLoadHistoryState({
            threadId: thread.id,
            mentalLoad: thread.currentMentalLoad,
            updatedAt,
            entries: existingEntries,
            loading: true,
            error: null,
        });
        mentalThreadService.getLoadHistory(thread.id, controller.signal)
            .then(entries => {
                cacheMentalThreadHistory(thread.id, {
                    mentalLoad: thread.currentMentalLoad,
                    updatedAt,
                    entries,
                });
                setLoadHistoryState({
                    threadId: thread.id,
                    mentalLoad: thread.currentMentalLoad,
                    updatedAt,
                    entries,
                    loading: false,
                    error: null,
                });
            })
            .catch(error => {
                if (error instanceof DOMException && error.name === 'AbortError') return;
                setLoadHistoryState({
                    threadId: thread.id,
                    mentalLoad: thread.currentMentalLoad,
                    updatedAt,
                    entries: [],
                    loading: false,
                    error: error instanceof Error ? error.message : 'Failed to load history',
                });
            });
        return () => controller.abort();
    }, [thread.id, thread.currentMentalLoad, thread.attentionState, thread.updatedAt]);

    const loadHistorySection = (
        <Box sx={{ mt: 2.5 }}>
            <Box sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) auto' },
                columnGap: { xs: 0, sm: 3, md: 4 },
                rowGap: { xs: 1.25, sm: 0 },
            }}>
                <Typography variant="overline" color="text.secondary" sx={{ gridColumn: 1, gridRow: 1 }}>
                    Load history
                </Typography>
                <Box sx={{ gridColumn: 1, gridRow: 2, minWidth: 0 }}>
                    {visibleHistory.loading && visibleHistory.entries.length === 0 ? (
                        <Box sx={{ minHeight: 76, display: 'flex', alignItems: 'center' }}>
                            {showHistoryLoading && (
                                <Typography variant="caption" color="text.secondary">Loading history…</Typography>
                            )}
                        </Box>
                    ) : visibleHistory.error ? (
                        <Alert severity="warning" sx={{ mt: 0.5, minHeight: 68 }}>{visibleHistory.error}</Alert>
                    ) : visibleHistory.entries.length === 0 ? (
                        <Box sx={{ minHeight: 76, display: 'flex', alignItems: 'center' }}>
                            <Typography variant="body2" color="text.secondary">No load history yet.</Typography>
                        </Box>
                    ) : (
                        <Stack
                            direction="row"
                            spacing={1}
                            onWheel={handleLoadHistoryWheel}
                            sx={{
                                mt: 0.5,
                                minHeight: 76,
                                overflowX: 'auto',
                                overscrollBehaviorX: 'contain',
                                pb: 1,
                            }}
                        >
                            {visibleHistory.entries.map((entry, index) => {
                                const entryPresentation = attentionStateDetails[entry.attentionState];
                                return (
                                    <Paper
                                        key={entry.id}
                                        variant="outlined"
                                        sx={{
                                            width: 112,
                                            flexShrink: 0,
                                            p: 1,
                                            borderRadius: 2,
                                            position: 'relative',
                                            bgcolor: alpha(entryPresentation.color, 0.065),
                                            borderColor: alpha(entryPresentation.color, 0.28),
                                        }}
                                        aria-label={`${entryPresentation.label}, load ${entry.load} out of 10`}
                                    >
                                        {index < visibleHistory.entries.length - 1 && (
                                            <Box sx={{ position: 'absolute', right: -9, top: 25, width: 9, borderTop: 1, borderColor: 'divider' }} />
                                        )}
                                        <Typography variant="h6" fontWeight={750} color={entryPresentation.color}>{entry.load}/10</Typography>
                                        <Typography variant="caption" color={entryPresentation.color} display="block">
                                            {entryPresentation.label}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" display="block">
                                            {new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })
                                                .format(new Date(entry.recordedAt))}
                                        </Typography>
                                        {entry.reason && (
                                            <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                                                {entry.reason}
                                            </Typography>
                                        )}
                                    </Paper>
                                );
                            })}
                        </Stack>
                    )}
                </Box>
                {thread.status === 'OPEN' ? (
                    <Button
                        size="small"
                        variant="outlined"
                        color="success"
                        startIcon={<TaskAltRoundedIcon />}
                        onClick={onCloseThread}
                        sx={theme => ({
                            gridColumn: { xs: 1, sm: 2 },
                            gridRow: { xs: 3, sm: 2 },
                            alignSelf: 'center',
                            justifySelf: { xs: 'center', sm: 'end' },
                            flexShrink: 0,
                            bgcolor: alpha(theme.palette.success.main, 0.06),
                            borderColor: alpha(theme.palette.success.main, 0.45),
                            '&:hover': {
                                bgcolor: alpha(theme.palette.success.main, 0.11),
                                borderColor: theme.palette.success.main,
                            },
                        })}
                    >
                        Close thread
                    </Button>
                ) : (
                    <Button
                        size="small"
                        variant="outlined"
                        startIcon={<ReplayRoundedIcon />}
                        onClick={onReopen}
                        sx={{
                            gridColumn: { xs: 1, sm: 2 },
                            gridRow: { xs: 3, sm: 2 },
                            alignSelf: 'center',
                            justifySelf: { xs: 'center', sm: 'end' },
                            flexShrink: 0,
                            color: attentionStateDetails.PENDING.color,
                            bgcolor: alpha(attentionStateDetails.PENDING.color, 0.06),
                            borderColor: alpha(attentionStateDetails.PENDING.color, 0.45),
                            '&:hover': {
                                bgcolor: alpha(attentionStateDetails.PENDING.color, 0.11),
                                borderColor: attentionStateDetails.PENDING.color,
                            },
                        }}
                    >
                        Reopen
                    </Button>
                )}
            </Box>
        </Box>
    );

    return (
        <Box sx={{ p: { xs: 1.5, md: 2 }, textAlign: 'left' }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                <Box sx={{ minWidth: 0 }}>
                    <Typography variant="caption" color="text.secondary">
                        Opened {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(thread.openedAt))}
                    </Typography>
                </Box>
                {isClosed ? (
                    <Chip
                        size="medium"
                        icon={isResolved ? <CheckCircleOutlineRoundedIcon /> : undefined}
                        label={thread.closureType ? closureTypeLabels[thread.closureType] : 'Closed'}
                        sx={{
                            flexShrink: 0,
                            minHeight: 36,
                            color: currentStateColor,
                            bgcolor: alpha(currentStateColor, 0.1),
                            fontWeight: 700,
                            '& .MuiChip-icon': {
                                color: currentStateColor,
                            },
                        }}
                    />
                ) : (
                    <MentalThreadStateChip thread={thread} onSave={onSave} />
                )}
            </Stack>

            {isClosed ? (
                <Paper
                    variant="outlined"
                    sx={{
                        mt: 1.5,
                        p: { xs: 1.25, md: 1.5 },
                        borderRadius: 2.5,
                        bgcolor: alpha(currentStateColor, 0.035),
                        borderColor: alpha(currentStateColor, 0.28),
                    }}
                >
                    <MentalThreadInlineEditor
                        thread={thread}
                        onSave={onSave}
                        readOnly
                        accentColor={currentStateColor}
                    />
                    {thread.resolutionSummary && (
                        <Box sx={{ mt: 2, pt: 1.5, borderTop: 1, borderColor: 'divider' }}>
                            <Typography variant="overline" color="text.secondary">
                                {thread.closureType ? closureTypeLabels[thread.closureType] : 'Closure'}
                            </Typography>
                            <Typography sx={{ whiteSpace: 'pre-wrap' }}>{thread.resolutionSummary}</Typography>
                        </Box>
                    )}
                    <ThreadTasksSection
                        tasks={tasks}
                        canAddTasks={false}
                        readOnly
                        onCreate={onCreateTask}
                        onToggle={onToggleTask}
                        onUpdate={onUpdateTask}
                        onDelete={onDeleteTask}
                    />
                    {loadHistorySection}
                </Paper>
            ) : (
                <Paper
                    variant="outlined"
                    sx={{
                        mt: 1.5,
                        p: { xs: 1.25, md: 1.5 },
                        borderRadius: 2.5,
                        bgcolor: alpha(currentStateColor, 0.035),
                        borderColor: alpha(currentStateColor, 0.28),
                    }}
                >
                    <MentalThreadInlineEditor thread={thread} onSave={onSave} />
                    <ThreadTasksSection
                        tasks={tasks}
                        canAddTasks
                        onCreate={onCreateTask}
                        onToggle={onToggleTask}
                        onUpdate={onUpdateTask}
                        onDelete={onDeleteTask}
                    />
                    {loadHistorySection}
                </Paper>
            )}

        </Box>
    );
}
