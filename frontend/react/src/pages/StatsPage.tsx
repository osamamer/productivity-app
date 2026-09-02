import React, { useState, useEffect, useCallback } from 'react';
import {
    Box, Button, Typography, Alert, Stack, Skeleton,
    Tooltip, IconButton, Dialog, DialogTitle, DialogContent,
    DialogContentText, DialogActions,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { PageWrapper } from '../components/PageWrapper';
import { CreateStatForm } from '../components/stats/CreateStatForm';
import { StatRecentDots } from '../components/stats/StatRecentDots';
import { StatCard } from '../components/stats/StatCard';
import { StatDefinition } from '../types/Stats';
import { statService } from '../services/api/statService';

const DEDICATED_SYSTEM_KEYS = new Set([
    'meditated',
    'meditation_minutes',
    'energy',
    'activation',
    'stimulation_hunger',
    'clarity',
    'stimulation',
    'hunger',
    'arousal',
    'valence',
    'emotional_load',
]);

const STAT_ACTIONS_WIDTH = 32;

function isDedicatedStat(definition: StatDefinition): boolean {
    return definition.systemKey !== undefined && DEDICATED_SYSTEM_KEYS.has(definition.systemKey);
}

function StatsLoadingState() {
    return (
        <Box sx={{
            display: 'flex',
            flex: 1,
            gap: 2,
            overflow: 'hidden',
            minHeight: 0,
            flexDirection: { xs: 'column', md: 'row' },
        }}>
            <Box sx={{
                width: { xs: '100%', md: 360 },
                flexShrink: 0,
                overflow: 'hidden',
                borderRadius: 2,
                border: 1,
                borderColor: 'divider',
                p: 1.5,
                display: 'flex',
                flexDirection: 'column',
                gap: 1.25,
                minHeight: { xs: 180, md: 0 },
                maxHeight: { xs: 270, md: 'none' },
            }}>
                {[0, 1, 2, 3, 4].map(item => (
                    <Box key={item}>
                        <Skeleton variant="text" width={`${55 + item * 7}%`} />
                        <Skeleton variant="text" width={`${38 + item * 5}%`} height={18} />
                    </Box>
                ))}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0, overflow: 'hidden', p: { xs: 0, md: 1 } }}>
                <Skeleton variant="rounded" height={44} sx={{ mb: 2 }} />
                <Skeleton variant="rounded" height={260} />
                <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
                    <Skeleton variant="rounded" height={52} sx={{ flex: 1 }} />
                    <Skeleton variant="rounded" height={52} sx={{ flex: 1 }} />
                </Stack>
            </Box>
        </Box>
    );
}

export function StatsPage() {
    const theme = useTheme();
    const [definitions, setDefinitions] = useState<StatDefinition[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [editTarget, setEditTarget] = useState<StatDefinition | null>(null);
    const [chartRefreshKey, setChartRefreshKey] = useState(0);
    const [deleteTarget, setDeleteTarget] = useState<StatDefinition | null>(null);
    const [draggedId, setDraggedId] = useState<string | null>(null);
    const [reorderSaving, setReorderSaving] = useState(false);
    const [orderError, setOrderError] = useState<string | null>(null);

    const loadDefinitions = useCallback(() => {
        setLoading(true);
        setError(null);
        statService.getDefinitions()
            .then(defs => {
                setDefinitions(defs);
                setSelectedId(prev => {
                    const visibleDefs = defs.filter(definition => !isDedicatedStat(definition));
                    if (prev && visibleDefs.some(d => d.id === prev)) return prev;
                    return visibleDefs[0]?.id ?? null;
                });
            })
            .catch(e => {
                console.error('Failed to load stat definitions:', e);
                setError('Failed to load statistics.');
            })
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { loadDefinitions(); }, [loadDefinitions]);

    const handleEntryChanged = useCallback(() => {
        setChartRefreshKey(key => key + 1);
    }, []);

    const handleCreated = (def: StatDefinition) => {
        setDefinitions(prev => [...prev, def]);
        setSelectedId(def.id);
        setShowCreateForm(false);
    };

    const handleUpdated = (updated: StatDefinition) => {
        setDefinitions(prev => prev.map(definition =>
            definition.id === updated.id ? updated : definition,
        ));
        setEditTarget(null);
    };

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        try {
            await statService.deleteDefinition(deleteTarget.id);
            setDefinitions(prev => {
                const next = prev.filter(d => d.id !== deleteTarget.id);
                const nextVisible = next.filter(definition => !isDedicatedStat(definition));
                setSelectedId(current => {
                    if (current !== deleteTarget.id) return current;
                    return nextVisible[0]?.id ?? null;
                });
                return next;
            });
            setEditTarget(null);
        } catch (e) {
            console.error('Failed to delete stat definition:', e);
        } finally {
            setDeleteTarget(null);
        }
    };

    const visibleDefinitions = definitions.filter(definition => !isDedicatedStat(definition));
    const selectedDef = visibleDefinitions.find(d => d.id === selectedId) ?? null;

    const handleDefinitionDrop = async (targetId: string) => {
        if (!draggedId || draggedId === targetId || reorderSaving) return;

        const previous = definitions;
        const visiblePrevious = previous.filter(definition => !isDedicatedStat(definition));
        const draggedIndex = visiblePrevious.findIndex(def => def.id === draggedId);
        const targetIndex = visiblePrevious.findIndex(def => def.id === targetId);
        if (draggedIndex < 0 || targetIndex < 0) return;

        const nextVisible = [...visiblePrevious];
        const [dragged] = nextVisible.splice(draggedIndex, 1);
        nextVisible.splice(draggedIndex < targetIndex ? targetIndex - 1 : targetIndex, 0, dragged);
        const next = [...nextVisible, ...previous.filter(isDedicatedStat)];
        setDefinitions(next);
        setDraggedId(null);
        setOrderError(null);
        setReorderSaving(true);

        try {
            const persisted = await statService.reorderDefinitions(next.map(def => def.id));
            setDefinitions(persisted);
        } catch (e) {
            console.error('Failed to reorder stat definitions:', e);
            setDefinitions(previous);
            setOrderError('Failed to save the statistics order.');
        } finally {
            setReorderSaving(false);
        }
    };

    return (
        <PageWrapper>
            <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, height: '100%' }}>

                {/* Header */}
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5, flexShrink: 0 }}>
                    <Typography variant="h5" fontWeight={600}>Statistics</Typography>
                    <Button
                        startIcon={<AddIcon />}
                        variant="outlined"
                        size="small"
                        onClick={() => setShowCreateForm(s => !s)}
                    >
                        {showCreateForm ? 'Cancel' : 'Add Stat'}
                    </Button>
                </Stack>

                <Dialog
                    open={showCreateForm}
                    onClose={() => setShowCreateForm(false)}
                    fullWidth
                    maxWidth="xs"
                >
                    <DialogTitle>Add statistic</DialogTitle>
                    <DialogContent dividers sx={{ p: 1.5 }}>
                        <CreateStatForm
                            onCreated={handleCreated}
                            onCancel={() => setShowCreateForm(false)}
                        />
                    </DialogContent>
                </Dialog>

                <Dialog
                    open={Boolean(editTarget)}
                    onClose={() => setEditTarget(null)}
                    fullWidth
                    maxWidth="xs"
                >
                    <DialogTitle>Edit statistic</DialogTitle>
                    <DialogContent dividers sx={{ p: 1.5 }}>
                        {editTarget && (
                            <CreateStatForm
                                initialDefinition={editTarget}
                                onUpdated={handleUpdated}
                                onDelete={() => setDeleteTarget(editTarget)}
                                onCancel={() => setEditTarget(null)}
                            />
                        )}
                    </DialogContent>
                </Dialog>

                {loading && <StatsLoadingState />}
                {error && <Alert severity="error">{error}</Alert>}
                {orderError && <Alert severity="error" sx={{ mb: 1.5 }}>{orderError}</Alert>}

                {!loading && !error && visibleDefinitions.length === 0 && (
                    <Box sx={{ textAlign: 'center', py: 10 }}>
                        <Typography variant="h6" color="text.secondary">No stats yet</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            Click "Add Stat" above to start tracking something.
                        </Typography>
                    </Box>
                )}

                {!loading && !error && visibleDefinitions.length > 0 && (
                    <Box sx={{
                        display: 'flex',
                        flex: 1,
                        gap: 2,
                        overflow: 'hidden',
                        minHeight: 0,
                        flexDirection: { xs: 'column', md: 'row' },
                    }}>

                        {/* Left panel — definition list */}
                        <Box sx={{
                            width: { xs: '100%', md: 360 },
                            flexShrink: 0,
                            overflowY: 'auto',
                            borderRadius: 2,
                            border: `1px solid ${theme.palette.divider}`,
                            display: 'flex',
                            flexDirection: 'column',
                            minHeight: { xs: 0, md: 0 },
                            maxHeight: { xs: 270, md: 'none' },
                        }}>
                            {visibleDefinitions.map((def, i) => {
                                const isSelected = def.id === selectedId;
                                return (
                                    <Box
                                        key={def.id}
                                        draggable={!reorderSaving}
                                        onDragStart={() => setDraggedId(def.id)}
                                        onDragEnd={() => setDraggedId(null)}
                                        onDragOver={event => event.preventDefault()}
                                        onDrop={() => { void handleDefinitionDrop(def.id); }}
                                        onClick={() => setSelectedId(def.id)}
                                        sx={{
                                            px: 2,
                                            py: 1.5,
                                            cursor: 'pointer',
                                            borderBottom: i < visibleDefinitions.length - 1
                                                ? `1px solid ${theme.palette.divider}`
                                                : 'none',
                                            bgcolor: isSelected
                                                ? theme.palette.mode === 'dark'
                                                    ? 'rgba(255,255,255,0.07)'
                                                    : 'rgba(25,118,210,0.06)'
                                                : 'transparent',
                                            borderLeft: isSelected
                                                ? `3px solid ${theme.palette.primary.main}`
                                                : '3px solid transparent',
                                            transition: 'background-color 0.15s, border-left-color 0.15s',
                                            opacity: draggedId === def.id ? 0.45 : 1,
                                            '&:hover': {
                                                bgcolor: isSelected
                                                    ? theme.palette.mode === 'dark'
                                                        ? 'rgba(255,255,255,0.1)'
                                                        : 'rgba(25,118,210,0.09)'
                                                    : theme.palette.action.hover,
                                            },
                                        }}
                                    >
                                        <Stack
                                            direction="row"
                                            alignItems="center"
                                            justifyContent="space-between"
                                            spacing={1}
                                        >
                                            <Box sx={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                                                <Typography
                                                    variant="body2"
                                                    fontWeight={isSelected ? 600 : 400}
                                                    noWrap
                                                >
                                                    {def.name}
                                                </Typography>
                                                {def.description && (
                                                    <Typography
                                                        variant="caption"
                                                        color="text.secondary"
                                                        noWrap
                                                        display="block"
                                                    >
                                                        {def.description}
                                                    </Typography>
                                                )}
                                            </Box>
                                            <Stack direction="row" alignItems="center" spacing={0.5} sx={{ flexShrink: 0 }}>
                                                <StatRecentDots
                                                    definition={def}
                                                    refreshKey={chartRefreshKey}
                                                    onEntryChanged={handleEntryChanged}
                                                />
                                                {!def.systemKey && (
                                                    <Box
                                                        sx={{
                                                            width: STAT_ACTIONS_WIDTH,
                                                            flexShrink: 0,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: 0.5,
                                                        }}
                                                    >
                                                        <Tooltip title="Edit stat">
                                                            <IconButton
                                                                size="small"
                                                                onClick={e => { e.stopPropagation(); setEditTarget(def); }}
                                                                sx={{ opacity: 0.5, '&:hover': { opacity: 1 } }}
                                                            >
                                                                <EditOutlinedIcon sx={{ fontSize: 16 }} />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </Box>
                                                )}
                                            </Stack>
                                        </Stack>
                                    </Box>
                                );
                            })}
                        </Box>

                        {/* Right panel — selected stat chart */}
                        <Box sx={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
                            {selectedDef ? (
                                <StatCard
                                    key={selectedDef.type === 'BOOLEAN' ? 'calendar' : 'numeric-chart'}
                                    definition={selectedDef}
                                    comparisonDefinitions={visibleDefinitions}
                                    onEdit={setEditTarget}
                                    refreshKey={chartRefreshKey}
                                    onEntryChanged={handleEntryChanged}
                                />
                            ) : (
                                <Box sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    height: '100%',
                                }}>
                                    <Typography color="text.secondary">
                                        Select a stat to view its history
                                    </Typography>
                                </Box>
                            )}
                        </Box>
                    </Box>
                )}
            </Box>

            {/* Delete confirmation dialog */}
            <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}>
                <DialogTitle>Delete "{deleteTarget?.name}"?</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        This will permanently delete the stat and all its recorded data. This cannot be undone.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
                    <Button color="error" onClick={handleDeleteConfirm}>Delete</Button>
                </DialogActions>
            </Dialog>
        </PageWrapper>
    );
}

export default StatsPage;
