import { useEffect, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    Chip,
    Divider,
    IconButton,
    Paper,
    Stack,
    Tooltip,
    Typography,
    alpha,
} from '@mui/material';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import { MentalThread, MentalThreadLoadEntry } from '../../types/MentalThread.ts';
import { Task } from '../../types/Task.tsx';
import { TaskToCreate } from '../../types/TaskToCreate.tsx';
import { mentalThreadService } from '../../services/api/mentalThreadService.ts';
import {
    cacheMentalThreadHistory,
    getCachedMentalThreadHistory,
} from '../../services/cache/mentalThreadHistoryCache.ts';
import { ThreadTasksSection } from './ThreadTasksSection.tsx';
import {
    attentionStateDetails,
    closedThreadColor,
    closureTypeLabels,
    resolvedThreadColor,
} from './mentalThreadPresentation.ts';

interface MentalThreadDetailProps {
    thread: MentalThread;
    onEdit: () => void;
    onCloseThread: () => void;
    onReopen: () => void;
    onDelete: () => void;
    tasks: Task[];
    onCreateTask: (task: TaskToCreate) => Promise<void>;
    onToggleTask: (task: Task) => Promise<void>;
}

interface LoadHistoryState {
    threadId: string;
    mentalLoad: number;
    updatedAt: string;
    entries: MentalThreadLoadEntry[];
    loading: boolean;
    error: string | null;
}

function formatDate(date: string | null): string {
    if (!date) return 'Not set';
    return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
        .format(new Date(`${date}T12:00:00`));
}

function DetailDate({ label, value, explanation }: { label: string; value: string | null; explanation: string }) {
    return (
        <Box sx={{ textAlign: 'left' }}>
            <Typography variant="caption" color="text.secondary">{label}</Typography>
            <Typography variant="body2" fontWeight={650}>{formatDate(value)}</Typography>
            <Typography variant="caption" color="text.secondary">{explanation}</Typography>
        </Box>
    );
}

export function MentalThreadDetail({
    thread,
    onEdit,
    onCloseThread,
    onReopen,
    onDelete,
    tasks,
    onCreateTask,
    onToggleTask,
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
    const presentation = attentionStateDetails[thread.attentionState];
    const isClosed = thread.status === 'CLOSED';
    const isResolved = thread.status === 'CLOSED' && thread.closureType === 'RESOLVED';
    const currentStateColor = isResolved
        ? resolvedThreadColor
        : isClosed ? closedThreadColor : presentation.color;
    const currentStateLabel = isClosed ? 'Closed' : presentation.label;
    const currentStateDescription = isClosed
        ? 'This thread is closed and no longer contributes to open mental load.'
        : presentation.description;
    const cachedHistory = getCachedMentalThreadHistory(thread.id);
    const stateMatchesThread = loadHistoryState.threadId === thread.id
        && loadHistoryState.mentalLoad === thread.currentMentalLoad
        && loadHistoryState.updatedAt === thread.updatedAt;
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
        const cached = getCachedMentalThreadHistory(thread.id);
        if (cached?.mentalLoad === thread.currentMentalLoad && cached.updatedAt === thread.updatedAt) {
            setLoadHistoryState({
                threadId: thread.id,
                mentalLoad: thread.currentMentalLoad,
                updatedAt: thread.updatedAt,
                entries: cached.entries,
                loading: false,
                error: null,
            });
            return;
        }

        const controller = new AbortController();
        setLoadHistoryState({
            threadId: thread.id,
            mentalLoad: thread.currentMentalLoad,
            updatedAt: thread.updatedAt,
            entries: [],
            loading: true,
            error: null,
        });
        mentalThreadService.getLoadHistory(thread.id, controller.signal)
            .then(entries => {
                cacheMentalThreadHistory(thread.id, {
                    mentalLoad: thread.currentMentalLoad,
                    updatedAt: thread.updatedAt,
                    entries,
                });
                setLoadHistoryState({
                    threadId: thread.id,
                    mentalLoad: thread.currentMentalLoad,
                    updatedAt: thread.updatedAt,
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
                    updatedAt: thread.updatedAt,
                    entries: [],
                    loading: false,
                    error: error instanceof Error ? error.message : 'Failed to load history',
                });
            });
        return () => controller.abort();
    }, [thread.id, thread.currentMentalLoad, thread.updatedAt]);

    return (
        <Box sx={{ p: { xs: 1.5, md: 2 }, textAlign: 'left' }}>
            <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
                <Box sx={{ minWidth: 0 }}>
                    <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                        <Chip
                            size="small"
                            icon={isResolved ? <CheckCircleOutlineRoundedIcon /> : undefined}
                            label={thread.status === 'CLOSED'
                                ? thread.closureType ? closureTypeLabels[thread.closureType] : 'Closed'
                                : presentation.label}
                            sx={{
                                color: currentStateColor,
                                bgcolor: alpha(currentStateColor, 0.1),
                                fontWeight: 700,
                                '& .MuiChip-icon': {
                                    color: currentStateColor,
                                },
                            }}
                        />
                        <Typography variant="caption" color="text.secondary">
                            Opened {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(thread.openedAt))}
                        </Typography>
                    </Stack>
                    <Typography variant="h5" fontWeight={720} sx={{ mt: 0.75, overflowWrap: 'anywhere' }}>
                        {thread.title}
                    </Typography>
                </Box>
                <Stack direction="row" alignItems="center">
                    {thread.status === 'OPEN' && (
                        <Tooltip title="Edit thread">
                            <IconButton onClick={onEdit} aria-label="Edit thread"><EditRoundedIcon /></IconButton>
                        </Tooltip>
                    )}
                    <Tooltip title="Delete thread permanently">
                        <IconButton onClick={onDelete} aria-label="Delete thread" color="error">
                            <DeleteOutlineRoundedIcon />
                        </IconButton>
                    </Tooltip>
                </Stack>
            </Stack>

            <Paper
                variant="outlined"
                sx={{ mt: 1.5, p: 1.5, borderRadius: 2.5, bgcolor: alpha(currentStateColor, 0.035) }}
            >
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                        <Typography variant="caption" color="text.secondary">Current mental load</Typography>
                        <Typography variant="h4" fontWeight={750} color={currentStateColor}>
                            {thread.currentMentalLoad}<Typography component="span" color="text.secondary">/10</Typography>
                        </Typography>
                    </Box>
                    <Box sx={{ maxWidth: 360, textAlign: 'right' }}>
                        <Typography variant="subtitle2" color={currentStateColor}>{currentStateLabel}</Typography>
                        <Typography variant="caption" color="text.secondary">{currentStateDescription}</Typography>
                    </Box>
                </Stack>
            </Paper>

            <Box sx={{ mt: 1.5, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
                <Box>
                    <Typography variant="overline" color="text.secondary">Context</Typography>
                    <Typography variant="body2" color={thread.description ? 'text.primary' : 'text.secondary'} sx={{ whiteSpace: 'pre-wrap' }}>
                        {thread.description || 'No context captured.'}
                    </Typography>
                </Box>
                <Box>
                    <Typography variant="overline" color="text.secondary">What complete would mean</Typography>
                    <Typography variant="body2" color={thread.desiredResolution ? 'text.primary' : 'text.secondary'} sx={{ whiteSpace: 'pre-wrap' }}>
                        {thread.desiredResolution || 'No desired resolution captured.'}
                    </Typography>
                </Box>
            </Box>

            <ThreadTasksSection
                tasks={tasks}
                canAddTasks={thread.status === 'OPEN'}
                onCreate={onCreateTask}
                onToggle={onToggleTask}
            />

            <Divider sx={{ my: 1.5 }} />
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 1.5 }}>
                <DetailDate label="Target close" value={thread.targetCloseDate} explanation="When you hope it is settled" />
                <DetailDate label="Hard deadline" value={thread.hardDeadlineDate} explanation="An external consequence" />
                <DetailDate label="Review again" value={thread.nextReviewDate} explanation="When it should return to attention" />
            </Box>

            {thread.status === 'CLOSED' && thread.resolutionSummary && (
                <Paper variant="outlined" sx={{ mt: 2, p: 1.5, borderRadius: 2.5 }}>
                    <Typography variant="overline" color="text.secondary">
                        {thread.closureType ? closureTypeLabels[thread.closureType] : 'Closure'}
                    </Typography>
                    <Typography sx={{ whiteSpace: 'pre-wrap' }}>{thread.resolutionSummary}</Typography>
                </Paper>
            )}

            <Box sx={{ mt: 1.5 }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} spacing={1.5}>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="overline" color="text.secondary">Load history</Typography>
                        {visibleHistory.loading ? (
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
                            <Stack direction="row" spacing={1} sx={{ mt: 0.5, minHeight: 76, overflowX: 'auto', pb: 1 }}>
                                {visibleHistory.entries.map((entry, index) => {
                                    const entryPresentation = attentionStateDetails[entry.attentionState];
                                    return (
                                    <Paper
                                        key={entry.id}
                                        variant="outlined"
                                        sx={{ width: 112, flexShrink: 0, p: 1, borderRadius: 2, position: 'relative' }}
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
                                alignSelf: { xs: 'center', sm: 'auto' },
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
                                alignSelf: { xs: 'center', sm: 'auto' },
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
                </Stack>
            </Box>
        </Box>
    );
}
