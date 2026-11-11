import React, { useEffect, useState } from 'react';
import { Box, Button, CircularProgress, MenuItem, TextField, Typography } from '@mui/material';
import { statGroupService, statService } from '../../services/api';
import { StatDefinition } from '../../types/Stats';
import { TaskGroup } from '../../types/TaskGroup';
import { TaskToCreate } from '../../types/TaskToCreate';
import { GroupTaskInputRow } from './GroupTaskInputRow';

type StatGroupTaskComposerProps = {
    group: TaskGroup;
    onSubmit: (statDefinitionId: string, task: TaskToCreate) => void | Promise<void>;
    onCancel: () => void;
};

function statGroupId(groupId: string): string {
    return groupId.startsWith('stat-group:') ? groupId.slice('stat-group:'.length) : groupId;
}

export function StatGroupTaskComposer({ group, onSubmit, onCancel }: StatGroupTaskComposerProps) {
    const [definitions, setDefinitions] = useState<StatDefinition[]>([]);
    const [selectedDefinitionId, setSelectedDefinitionId] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [loadFailed, setLoadFailed] = useState(false);
    const [submitFailed, setSubmitFailed] = useState(false);

    useEffect(() => {
        let active = true;
        setLoading(true);
        setLoadFailed(false);
        void Promise.all([
            statGroupService.getGroups(true),
            statService.getDefinitions(),
        ]).then(([statGroups, visibleDefinitions]) => {
            if (!active) return;
            const matchingGroup = statGroups.find(candidate => candidate.groupId === statGroupId(group.groupId));
            const groupDefinitionIds = new Set(matchingGroup?.statDefinitionIds ?? []);
            const availableDefinitions = visibleDefinitions
                .filter(definition => groupDefinitionIds.has(definition.id))
                .sort((first, second) => first.displayOrder - second.displayOrder);
            setDefinitions(availableDefinitions);
            setSelectedDefinitionId(availableDefinitions.length === 1 ? availableDefinitions[0].id : '');
        }).catch(error => {
            console.error('Could not load statistic links for task group:', error);
            if (active) setLoadFailed(true);
        }).finally(() => {
            if (active) setLoading(false);
        });

        return () => {
            active = false;
        };
    }, [group.groupId]);

    const handleSubmit = async (task: TaskToCreate) => {
        if (!selectedDefinitionId || !task.name.trim() || submitting) return;
        setSubmitting(true);
        setSubmitFailed(false);
        try {
            await onSubmit(selectedDefinitionId, task);
            onCancel();
        } catch {
            setSubmitFailed(true);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Box
            sx={{
                display: 'grid',
                gap: 0.75,
                p: 1,
                mb: 0.75,
                borderRadius: 1.5,
                backgroundColor: 'action.hover',
            }}
            onClick={event => event.stopPropagation()}
        >
            {loading ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
                    <CircularProgress size={16} />
                    <Typography variant="body2" color="text.secondary">Loading linked statistics…</Typography>
                </Box>
            ) : loadFailed ? (
                <Typography variant="body2" color="error.main">Could not load linked statistics.</Typography>
            ) : definitions.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                    No accessible statistics are linked to this group.
                </Typography>
            ) : (
                <>
                    {definitions.length > 1 && (
                        <TextField
                            select
                            size="small"
                            label="Link task to statistic"
                            value={selectedDefinitionId}
                            onChange={event => setSelectedDefinitionId(event.target.value)}
                            disabled={submitting}
                        >
                            <MenuItem value="" disabled>Select a statistic</MenuItem>
                            {definitions.map(definition => (
                                <MenuItem key={definition.id} value={definition.id}>{definition.name}</MenuItem>
                            ))}
                        </TextField>
                    )}
                    {selectedDefinitionId && (
                        <GroupTaskInputRow
                            contextName={group.name}
                            placeholder="Add linked task"
                            autoFocus
                            onSubmit={task => void handleSubmit(task)}
                            onEscape={onCancel}
                            onBlur={onCancel}
                        />
                    )}
                    {submitFailed && (
                        <Typography variant="caption" color="error.main">
                            Could not add the linked task. Try again.
                        </Typography>
                    )}
                </>
            )}
            {(loadFailed || definitions.length === 0) && !loading && (
                <Button size="small" onClick={onCancel} sx={{ justifySelf: 'end' }}>Close</Button>
            )}
        </Box>
    );
}
