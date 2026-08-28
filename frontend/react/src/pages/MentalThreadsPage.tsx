import { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    FormControl,
    FormControlLabel,
    InputLabel,
    MenuItem,
    Select,
    Snackbar,
    Stack,
    Switch,
    Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import HubRoundedIcon from '@mui/icons-material/HubRounded';
import { PageWrapper } from '../components/PageWrapper.tsx';
import { MentalLoadOverview } from '../components/mental-threads/MentalLoadOverview.tsx';
import { MentalThreadList } from '../components/mental-threads/MentalThreadList.tsx';
import { MentalThreadDetail } from '../components/mental-threads/MentalThreadDetail.tsx';
import { MentalThreadFormDialog } from '../components/mental-threads/MentalThreadFormDialog.tsx';
import { CloseMentalThreadDialog } from '../components/mental-threads/CloseMentalThreadDialog.tsx';
import { attentionStateDetails, attentionStates } from '../components/mental-threads/mentalThreadPresentation.ts';
import { useMentalThreadsWorkspace } from '../hooks/useMentalThreadsWorkspace.ts';
import {
    AttentionState,
    CloseMentalThreadInput,
    MentalThread,
    MentalThreadInput,
} from '../types/MentalThread.ts';

type StateFilter = AttentionState | 'ALL';

export function MentalThreadsPage() {
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
        checkInCapacity,
    } = useMentalThreadsWorkspace();
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [showClosed, setShowClosed] = useState(false);
    const [stateFilter, setStateFilter] = useState<StateFilter>('ALL');
    const [formOpen, setFormOpen] = useState(false);
    const [editingThread, setEditingThread] = useState<MentalThread | null>(null);
    const [closingThread, setClosingThread] = useState<MentalThread | null>(null);
    const [deletingThread, setDeletingThread] = useState<MentalThread | null>(null);

    const visibleThreads = useMemo(() => threads.filter(thread => {
        if (!showClosed && thread.status === 'CLOSED') return false;
        return stateFilter === 'ALL' || thread.attentionState === stateFilter;
    }), [showClosed, stateFilter, threads]);

    const selectedThread = useMemo(
        () => visibleThreads.find(thread => thread.id === selectedId) ?? null,
        [selectedId, visibleThreads],
    );

    useEffect(() => {
        if (!selectedThread) setSelectedId(visibleThreads[0]?.id ?? null);
    }, [selectedThread, visibleThreads]);

    const handleCreate = async (input: MentalThreadInput) => {
        const created = await createThread(input);
        if (created) setSelectedId(created.id);
        return Boolean(created);
    };

    const handleUpdate = async (input: MentalThreadInput) => {
        if (!editingThread) return false;
        return Boolean(await updateThread(editingThread.id, input));
    };

    const handleClose = async (input: CloseMentalThreadInput) => {
        if (!closingThread) return false;
        return Boolean(await closeThread(closingThread.id, input));
    };

    const handleReopen = async () => {
        if (!selectedThread) return;
        await reopenThread(selectedThread.id);
    };

    const handleDelete = async () => {
        if (!deletingThread) return;
        const deleted = await deleteThread(deletingThread.id);
        if (deleted) {
            setDeletingThread(null);
            setSelectedId(null);
        }
    };

    return (
        <PageWrapper>
            <Box sx={{
                width: '100%',
                maxWidth: 1500,
                mx: 'auto',
            }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2} sx={{ mb: 1 }}>
                    <Box sx={{ textAlign: 'left' }}>
                        <Typography variant="h6" fontWeight={720}>Mental threads</Typography>
                        <Typography variant="caption" color="text.secondary">
                            See what is occupying attention, contain it, and notice when the load changes.
                        </Typography>
                    </Box>
                    <Button
                        variant="contained"
                        startIcon={<AddRoundedIcon />}
                        onClick={() => {
                            setEditingThread(null);
                            setFormOpen(true);
                        }}
                    >
                        New thread
                    </Button>
                </Stack>

                {loading ? (
                    <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 320 }}>
                        <CircularProgress size={32} />
                    </Box>
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
                        display: 'grid',
                        gridTemplateRows: 'auto auto 1fr',
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 3,
                        bgcolor: 'background.paper',
                        overflow: 'hidden',
                    }}>
                        <MentalLoadOverview
                            summary={summary}
                            onCapacitySave={checkInCapacity}
                        />

                        <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            alignItems={{ xs: 'stretch', sm: 'center' }}
                            justifyContent="space-between"
                            spacing={1.5}
                            sx={{ px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider' }}
                        >
                            <Typography variant="subtitle1" fontWeight={700}>Threads</Typography>
                            <Stack direction="row" alignItems="center" spacing={1.5}>
                                <FormControl size="small" sx={{ minWidth: 145 }}>
                                    <InputLabel id="thread-state-filter-label">Attention state</InputLabel>
                                    <Select
                                        labelId="thread-state-filter-label"
                                        label="Attention state"
                                        value={stateFilter}
                                        onChange={event => setStateFilter(event.target.value as StateFilter)}
                                    >
                                        <MenuItem value="ALL">All states</MenuItem>
                                        {attentionStates.map(state => (
                                            <MenuItem key={state} value={state}>{attentionStateDetails[state].label}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                                <FormControlLabel
                                    control={<Switch checked={showClosed} onChange={event => setShowClosed(event.target.checked)} />}
                                    label="Show closed"
                                />
                            </Stack>
                        </Stack>

                        <Box sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', md: 'minmax(320px, 420px) minmax(0, 1fr)' },
                            minHeight: 390,
                        }}>
                            <Box sx={{
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
                                    onSelect={setSelectedId}
                                />
                            </Box>
                            {selectedThread ? (
                                <Box sx={{ minWidth: 0 }}>
                                    <MentalThreadDetail
                                        thread={selectedThread}
                                        onEdit={() => {
                                            setEditingThread(selectedThread);
                                            setFormOpen(true);
                                        }}
                                        onCloseThread={() => setClosingThread(selectedThread)}
                                        onReopen={() => void handleReopen()}
                                        onDelete={() => setDeletingThread(selectedThread)}
                                    />
                                </Box>
                            ) : (
                                <Box sx={{ display: 'grid', placeItems: 'center', p: 4 }}>
                                    <Box sx={{ maxWidth: 400, textAlign: 'center' }}>
                                        <HubRoundedIcon color="primary" sx={{ fontSize: 52, opacity: 0.75 }} />
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

            <MentalThreadFormDialog
                open={formOpen}
                thread={editingThread}
                onClose={() => setFormOpen(false)}
                onSave={editingThread ? handleUpdate : handleCreate}
            />
            <CloseMentalThreadDialog
                thread={closingThread}
                onClose={() => setClosingThread(null)}
                onConfirm={handleClose}
            />
            <Dialog open={Boolean(deletingThread)} onClose={() => setDeletingThread(null)}>
                <DialogTitle>Delete this mental thread?</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        “{deletingThread?.title}” and its load history will be permanently deleted.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeletingThread(null)}>Cancel</Button>
                    <Button color="error" onClick={() => void handleDelete()}>Delete</Button>
                </DialogActions>
            </Dialog>
            <Snackbar
                open={Boolean(operationError)}
                autoHideDuration={5000}
                onClose={clearOperationError}
                message={operationError}
            />
        </PageWrapper>
    );
}
