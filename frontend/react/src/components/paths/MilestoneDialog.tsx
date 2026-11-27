import AddRoundedIcon from '@mui/icons-material/AddRounded';
import {
    Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, LinearProgress, Switch,
    TextField, Typography,
} from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { pathService } from '../../services/api/pathService';
import { projectService } from '../../services/api/projectService';
import { statService } from '../../services/api/statService';
import type { StatDefinition } from '../../types/Stats';
import type { Checkpoint, Milestone } from '../../types/Path';
import type { Task } from '../../types/Task';
import { CheckpointEditor } from './CheckpointEditor';
import { CheckpointTasks } from './CheckpointTasks';
import { formFromCheckpoint, newCheckpointForm } from './checkpointDraft';
import { checkpointMetricText, shortDate } from './milestoneText';
import { statOptions } from './pathDraft';

interface Props {
    pathId: string;
    pathName: string;
    color: string;
    /** The milestone to edit, or null to add one. */
    milestone: Milestone | null;
    today: string;
    onClose: () => void;
    /** Something changed; the page reloads. Gives the id of a milestone just created. */
    onChanged: (createdMilestoneId?: string) => Promise<void>;
}

type CheckpointEditing = { checkpoint: Checkpoint | null } | null;

/** A milestone (the end of a project) with its checkpoints and the tasks under them. */
export function MilestoneDialog({ pathId, pathName, color, milestone, today, onClose, onChanged }: Props) {
    const [name, setName] = useState(milestone?.name ?? '');
    const [targetDate, setTargetDate] = useState(milestone?.targetDate ?? '');
    const [definitions, setDefinitions] = useState<StatDefinition[]>(() => statService.getCachedDefinitions() ?? []);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [editing, setEditing] = useState<CheckpointEditing>(null);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const options = useMemo(() => statOptions(definitions, statService.hasSecretStatsAccess()), [definitions]);
    const projectId = milestone?.projectId ?? null;

    useEffect(() => {
        statService.getDefinitions()
            .then(setDefinitions)
            .catch(loadError => console.error('Could not load stats for the milestone editor:', loadError));
    }, []);

    const loadTasks = useCallback(() => {
        if (!projectId) return;
        projectService.getProjectTasks(projectId)
            .then(setTasks)
            .catch(loadError => console.error('Could not load the milestone tasks:', loadError));
    }, [projectId]);
    useEffect(loadTasks, [loadTasks]);

    const run = async (action: () => Promise<void>, failure: string) => {
        setSaving(true);
        setError(null);
        try {
            await action();
        } catch (actionError) {
            console.error(`${failure}:`, actionError);
            setError(actionError instanceof Error ? actionError.message : failure);
        } finally {
            setSaving(false);
        }
    };

    const saveMilestone = () => {
        if (!name.trim()) return setError('Give the milestone a name.');
        return run(async () => {
            const draft = { name: name.trim(), targetDate: targetDate || null };
            if (milestone) {
                await pathService.updateMilestone(pathId, milestone.id, draft, today);
                await onChanged();
                onClose();
            } else {
                const created = await pathService.createMilestone(pathId, draft, today);
                await onChanged(created.id);
            }
        }, 'Could not save the milestone');
    };

    const setDone = (done: boolean) => milestone && run(async () => {
        await pathService.updateMilestone(pathId, milestone.id, { done }, today);
        await onChanged();
    }, 'Could not save the milestone');

    const remove = () => {
        if (!milestone) return;
        if (!confirmDelete) return setConfirmDelete(true);
        return run(async () => {
            await pathService.deleteMilestone(pathId, milestone.id);
            await onChanged();
            onClose();
        }, 'Could not delete the milestone');
    };

    const afterCheckpointChange = async () => {
        setEditing(null);
        await onChanged();
        loadTasks();
    };

    const startDate = milestone?.checkpoints[0]?.metric.countFrom ?? today;
    const changedFields = milestone && (name.trim() !== milestone.name || (targetDate || null) !== milestone.targetDate);

    return (
        <Dialog open onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="milestone-title">
            <DialogTitle id="milestone-title">
                {milestone ? milestone.name : `New milestone on ${pathName}`}
                {milestone && (
                    <Typography variant="body2" color="text.secondary">
                        {milestone.done && milestone.doneOn ? `Done ${shortDate(milestone.doneOn)}` : `${Math.round(milestone.progress * 100)}% of the way`}
                    </Typography>
                )}
            </DialogTitle>
            <DialogContent sx={{ display: 'grid', gap: 2, pt: '8px !important' }}>
                <Typography variant="body2" color="text.secondary">
                    A milestone is the end of a project. Checkpoints along the way are measured by stats you log.
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <TextField label="Milestone" value={name} autoFocus={!milestone} placeholder="Finish the rewrite"
                               inputProps={{ maxLength: 120 }} sx={{ flex: '2 1 220px' }} onChange={event => setName(event.target.value)} />
                    <TextField type="date" label="Target date" value={targetDate} InputLabelProps={{ shrink: true }}
                               helperText="Empty puts it in Someday" sx={{ flex: '1 1 160px' }}
                               onChange={event => setTargetDate(event.target.value)} />
                </Box>
                {milestone && (
                    <FormControlLabel control={<Switch checked={milestone.done} disabled={saving} onChange={event => setDone(event.target.checked)} />}
                                      label="Done" />
                )}

                {milestone && (
                    <Box sx={{ display: 'grid', gap: 1.25 }}>
                        <Typography variant="subtitle2" fontWeight={700}>Checkpoints</Typography>
                        {milestone.checkpoints.length === 0 && !editing && (
                            <Typography variant="body2" color="text.secondary">
                                No checkpoints yet. Each one is a step with a stat target, like 80k words by the end of December.
                            </Typography>
                        )}
                        {milestone.checkpoints.map(checkpoint => (
                            editing?.checkpoint?.id === checkpoint.id ? (
                                <CheckpointEditor key={checkpoint.id} initial={formFromCheckpoint(checkpoint)} options={options}
                                                  definitions={definitions} submitLabel="Save checkpoint" onCancel={() => setEditing(null)}
                                                  onSubmit={async draft => {
                                                      await pathService.updateCheckpoint(checkpoint.projectId, checkpoint.id, draft, today);
                                                      await afterCheckpointChange();
                                                  }} />
                            ) : (
                                <Box key={checkpoint.id} sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 1.25 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
                                        <Typography fontWeight={700} sx={{ flex: 1 }}>
                                            {checkpoint.reachedOn ? '✓ ' : ''}{checkpoint.name}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {checkpoint.targetDate ? shortDate(checkpoint.targetDate) : 'no date'}
                                        </Typography>
                                        <Button size="small" sx={{ textTransform: 'none' }} onClick={() => setEditing({ checkpoint })}>Edit</Button>
                                        <Button size="small" color="error" sx={{ textTransform: 'none' }}
                                                onClick={() => run(async () => {
                                                    await pathService.deleteCheckpoint(checkpoint.projectId, checkpoint.id);
                                                    await afterCheckpointChange();
                                                }, 'Could not delete the checkpoint')}>
                                            Delete
                                        </Button>
                                    </Box>
                                    <LinearProgress variant="determinate" value={checkpoint.progress * 100} aria-label={`${checkpoint.name} progress`}
                                                    sx={{ my: 0.75, height: 6, borderRadius: 3, '& .MuiLinearProgress-bar': { background: color } }} />
                                    <Typography variant="caption" color="text.secondary">
                                        {checkpoint.metric.statName ?? 'Deleted stat'}: {checkpointMetricText(checkpoint)}
                                        {checkpoint.reachedOn ? ` · reached ${shortDate(checkpoint.reachedOn)}` : ''}
                                    </Typography>
                                    <CheckpointTasks checkpointId={checkpoint.id} onChanged={() => { loadTasks(); void onChanged(); }}
                                                     tasks={tasks.filter(task => task.checkpointId === checkpoint.id)} />
                                </Box>
                            )
                        ))}
                        {editing && editing.checkpoint === null ? (
                            <CheckpointEditor initial={newCheckpointForm(options[0]?.definition, startDate)} options={options}
                                              definitions={definitions} submitLabel="Add checkpoint" onCancel={() => setEditing(null)}
                                              onSubmit={async draft => {
                                                  await pathService.createCheckpoint(milestone.projectId, draft, today);
                                                  await afterCheckpointChange();
                                              }} />
                        ) : (
                            <Button size="small" startIcon={<AddRoundedIcon />} sx={{ justifySelf: 'start', textTransform: 'none' }}
                                    disabled={options.length === 0} onClick={() => setEditing({ checkpoint: null })}>
                                Add a checkpoint
                            </Button>
                        )}
                        {options.length === 0 && (
                            <Typography variant="caption" color="text.secondary">Checkpoints are measured by stats; create one on the Statistics page first.</Typography>
                        )}
                    </Box>
                )}
                {error && <Alert severity="error">{error}</Alert>}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                {milestone && (
                    <Button color="error" onClick={remove} disabled={saving} sx={{ mr: 'auto', textTransform: 'none' }}>
                        {confirmDelete ? 'Delete milestone and project' : 'Delete milestone'}
                    </Button>
                )}
                <Button onClick={onClose} sx={{ textTransform: 'none' }}>{milestone ? 'Close' : 'Cancel'}</Button>
                {(!milestone || changedFields) && (
                    <Button variant="contained" onClick={saveMilestone} disabled={saving} sx={{ textTransform: 'none', fontWeight: 700 }}>
                        {milestone ? 'Save' : 'Add milestone'}
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
}

