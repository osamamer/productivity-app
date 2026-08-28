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
import { mentalThreadService } from '../../services/api/mentalThreadService.ts';
import { attentionStateDetails, closureTypeLabels } from './mentalThreadPresentation.ts';

interface MentalThreadDetailProps {
    thread: MentalThread;
    onEdit: () => void;
    onCloseThread: () => void;
    onReopen: () => void;
    onDelete: () => void;
}

interface LoadHistoryState {
    threadId: string;
    mentalLoad: number;
    entries: MentalThreadLoadEntry[];
    loading: boolean;
    error: string | null;
}

const loadHistoryCache = new Map<string, { mentalLoad: number; entries: MentalThreadLoadEntry[] }>();

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
}: MentalThreadDetailProps) {
    const [loadHistoryState, setLoadHistoryState] = useState<LoadHistoryState>({
        threadId: thread.id,
        mentalLoad: thread.currentMentalLoad,
        entries: [],
        loading: true,
        error: null,
    });
    const presentation = attentionStateDetails[thread.attentionState];
    const isResolved = thread.status === 'CLOSED' && thread.closureType === 'RESOLVED';
    const cachedHistory = loadHistoryCache.get(thread.id);
    const stateMatchesThread = loadHistoryState.threadId === thread.id
        && loadHistoryState.mentalLoad === thread.currentMentalLoad;
    const visibleHistory: LoadHistoryState = stateMatchesThread
        ? loadHistoryState
        : cachedHistory?.mentalLoad === thread.currentMentalLoad
            ? {
                threadId: thread.id,
                mentalLoad: thread.currentMentalLoad,
                entries: cachedHistory.entries,
                loading: false,
                error: null,
            }
            : {
                threadId: thread.id,
                mentalLoad: thread.currentMentalLoad,
                entries: [],
                loading: true,
                error: null,
            };

    useEffect(() => {
        const cached = loadHistoryCache.get(thread.id);
        if (cached?.mentalLoad === thread.currentMentalLoad) {
            return;
        }

        const controller = new AbortController();
        setLoadHistoryState({
            threadId: thread.id,
            mentalLoad: thread.currentMentalLoad,
            entries: [],
            loading: true,
            error: null,
        });
        mentalThreadService.getLoadHistory(thread.id, controller.signal)
            .then(entries => {
                loadHistoryCache.set(thread.id, { mentalLoad: thread.currentMentalLoad, entries });
                setLoadHistoryState({
                    threadId: thread.id,
                    mentalLoad: thread.currentMentalLoad,
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
                    entries: [],
                    loading: false,
                    error: error instanceof Error ? error.message : 'Failed to load history',
                });
            });
        return () => controller.abort();
    }, [thread.id, thread.currentMentalLoad]);

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
                            sx={theme => ({
                                color: isResolved ? theme.palette.success.main : presentation.color,
                                bgcolor: alpha(isResolved ? theme.palette.success.main : presentation.color, 0.1),
                                fontWeight: 700,
                                '& .MuiChip-icon': {
                                    color: isResolved ? theme.palette.success.main : presentation.color,
                                },
                            })}
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
                sx={{ mt: 1.5, p: 1.5, borderRadius: 2.5, bgcolor: alpha(presentation.color, 0.035) }}
            >
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                        <Typography variant="caption" color="text.secondary">Current mental load</Typography>
                        <Typography variant="h4" fontWeight={750} color={presentation.color}>
                            {thread.currentMentalLoad}<Typography component="span" color="text.secondary">/10</Typography>
                        </Typography>
                    </Box>
                    <Box sx={{ maxWidth: 360, textAlign: 'right' }}>
                        <Typography variant="subtitle2">{presentation.label}</Typography>
                        <Typography variant="caption" color="text.secondary">{presentation.description}</Typography>
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
                                <Typography variant="caption" color="text.secondary">Loading history…</Typography>
                            </Box>
                        ) : visibleHistory.error ? (
                            <Alert severity="warning" sx={{ mt: 0.5, minHeight: 68 }}>{visibleHistory.error}</Alert>
                        ) : visibleHistory.entries.length === 0 ? (
                            <Box sx={{ minHeight: 76, display: 'flex', alignItems: 'center' }}>
                                <Typography variant="body2" color="text.secondary">No load history yet.</Typography>
                            </Box>
                        ) : (
                            <Stack direction="row" spacing={1} sx={{ mt: 0.5, minHeight: 76, overflowX: 'auto', pb: 1 }}>
                                {visibleHistory.entries.map((entry, index) => (
                                    <Paper
                                        key={entry.id}
                                        variant="outlined"
                                        sx={{ width: 112, flexShrink: 0, p: 1, borderRadius: 2, position: 'relative' }}
                                    >
                                        {index < visibleHistory.entries.length - 1 && (
                                            <Box sx={{ position: 'absolute', right: -9, top: 25, width: 9, borderTop: 1, borderColor: 'divider' }} />
                                        )}
                                        <Typography variant="h6" fontWeight={750} color={presentation.color}>{entry.load}/10</Typography>
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
                                ))}
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
