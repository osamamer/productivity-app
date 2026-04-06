import React, { useState, useEffect, useCallback } from 'react';
import {
    Box, Button, Collapse, Typography, CircularProgress, Alert, Stack,
    Tooltip, IconButton, Dialog, DialogTitle, DialogContent,
    DialogContentText, DialogActions,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { PageWrapper } from '../components/PageWrapper';
import { CreateStatForm } from '../components/stats/CreateStatForm';
import { StatRecentDots } from '../components/stats/StatRecentDots';
import { StatCard } from '../components/stats/StatCard';
import { StatDefinition } from '../types/Stats';
import { statService } from '../services/api/statService';

export function StatsPage() {
    const theme = useTheme();
    const [definitions, setDefinitions] = useState<StatDefinition[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [chartRefreshKey, setChartRefreshKey] = useState(0);
    const [deleteTarget, setDeleteTarget] = useState<StatDefinition | null>(null);

    const loadDefinitions = useCallback(() => {
        setLoading(true);
        statService.getDefinitions()
            .then(defs => {
                setDefinitions(defs);
                setSelectedId(prev => {
                    if (prev && defs.some(d => d.id === prev)) return prev;
                    return defs[0]?.id ?? null;
                });
            })
            .catch(e => {
                console.error('Failed to load stat definitions:', e);
                setError('Failed to load statistics.');
            })
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { loadDefinitions(); }, [loadDefinitions]);

    const handleCreated = (def: StatDefinition) => {
        setDefinitions(prev => [...prev, def]);
        setSelectedId(def.id);
        setShowCreateForm(false);
    };

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        try {
            await statService.deleteDefinition(deleteTarget.id);
            setDefinitions(prev => {
                const next = prev.filter(d => d.id !== deleteTarget.id);
                setSelectedId(current => {
                    if (current !== deleteTarget.id) return current;
                    return next[0]?.id ?? null;
                });
                return next;
            });
        } catch (e) {
            console.error('Failed to delete stat definition:', e);
        } finally {
            setDeleteTarget(null);
        }
    };

    const selectedDef = definitions.find(d => d.id === selectedId) ?? null;

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

                <Collapse in={showCreateForm} sx={{ flexShrink: 0 }}>
                    <Box sx={{ mb: 2 }}>
                        <CreateStatForm
                            onCreated={handleCreated}
                            onCancel={() => setShowCreateForm(false)}
                        />
                    </Box>
                </Collapse>

                {loading && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
                        <CircularProgress size={32} />
                    </Box>
                )}
                {error && <Alert severity="error">{error}</Alert>}

                {!loading && !error && definitions.length === 0 && (
                    <Box sx={{ textAlign: 'center', py: 10 }}>
                        <Typography variant="h6" color="text.secondary">No stats yet</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            Click "Add Stat" above to start tracking something.
                        </Typography>
                    </Box>
                )}

                {!loading && !error && definitions.length > 0 && (
                    <Box sx={{
                        display: 'flex',
                        flex: 1,
                        gap: 2,
                        overflow: 'hidden',
                        minHeight: 0,
                    }}>

                        {/* Left panel — definition list */}
                        <Box sx={{
                            width: 360,
                            flexShrink: 0,
                            overflowY: 'auto',
                            borderRadius: 2,
                            border: `1px solid ${theme.palette.divider}`,
                            display: 'flex',
                            flexDirection: 'column',
                        }}>
                            {definitions.map((def, i) => {
                                const isSelected = def.id === selectedId;
                                return (
                                    <Box
                                        key={def.id}
                                        onClick={() => setSelectedId(def.id)}
                                        sx={{
                                            px: 2,
                                            py: 1.5,
                                            cursor: 'pointer',
                                            borderBottom: i < definitions.length - 1
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
                                            <Box sx={{ minWidth: 0, flex: 1 }}>
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
                                                    onEntryChanged={() => setChartRefreshKey(k => k + 1)}
                                                />
                                                <Tooltip title="Delete stat and all its data">
                                                    <IconButton
                                                        size="small"
                                                        onClick={e => { e.stopPropagation(); setDeleteTarget(def); }}
                                                        sx={{ ml: 0.5, opacity: 0.5, '&:hover': { opacity: 1 } }}
                                                    >
                                                        <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                                                    </IconButton>
                                                </Tooltip>
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
                                    key={selectedDef.id}
                                    definition={selectedDef}
                                    onDelete={id => setDeleteTarget(definitions.find(d => d.id === id) ?? null)}
                                    refreshKey={chartRefreshKey}
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
