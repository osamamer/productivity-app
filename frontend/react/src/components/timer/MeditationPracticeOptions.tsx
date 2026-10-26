import { useRef, useState, type MouseEvent } from 'react';
import { Alert, Button, FormControlLabel, Stack, Switch, Typography } from '@mui/material';
import { statService } from '../../services/api/statService';
import {
    StatDefinition, StatRecurringTaskDraft,
} from '../../types/Stats';
import { StatRecurringTaskDialog } from '../stats/StatRecurringTaskDialog';
import { defaultStatRecurringTaskDraft, timeOfDayFromDateTime } from '../stats/statRecurringTaskUtils';

interface MeditationDefinitions {
    meditated: StatDefinition;
    minutes: StatDefinition;
}

type PopupPosition = { top: number; left: number };

interface MeditationPracticeOptionsProps {
    definitions: MeditationDefinitions;
    onDefinitionUpdated: (definition: StatDefinition) => void;
}

function popupPositionForElement(element: HTMLElement): PopupPosition {
    const bounds = element.getBoundingClientRect();
    return { top: bounds.bottom + 8, left: bounds.left };
}

export function MeditationPracticeOptions({ definitions, onDefinitionUpdated }: MeditationPracticeOptionsProps) {
    const visibilityMutationVersionRef = useRef(0);
    const definitionsRef = useRef(definitions);
    definitionsRef.current = definitions;
    const [recurringTaskSaving, setRecurringTaskSaving] = useState(false);
    const [recurringTaskLoading, setRecurringTaskLoading] = useState(false);
    const [recurringTaskMode, setRecurringTaskMode] = useState<'create' | 'update'>('create');
    const [recurringTaskAnchorPosition, setRecurringTaskAnchorPosition] = useState<PopupPosition | null>(null);
    const [recurringTaskInitialDraft, setRecurringTaskInitialDraft] = useState<StatRecurringTaskDraft | null>(null);
    const [recurringTaskError, setRecurringTaskError] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);

    const handleStatsVisibilityChange = (showOnStatsPage: boolean) => {
        const previous = definitionsRef.current.meditated;
        const mutationVersion = ++visibilityMutationVersionRef.current;
        const optimistic = { ...previous, showOnStatsPage };
        definitionsRef.current = { ...definitionsRef.current, meditated: optimistic };
        onDefinitionUpdated(optimistic);
        setActionError(null);
        void statService.updateStatsPageVisibility(previous.id, showOnStatsPage)
            .then(updated => {
                if (mutationVersion === visibilityMutationVersionRef.current) {
                    definitionsRef.current = { ...definitionsRef.current, meditated: updated };
                    onDefinitionUpdated(updated);
                }
            })
            .catch(saveError => {
                console.error('Failed to update meditation Stats page visibility:', saveError);
                if (mutationVersion === visibilityMutationVersionRef.current) {
                    const restored = {
                        ...definitionsRef.current.meditated,
                        showOnStatsPage: previous.showOnStatsPage,
                    };
                    definitionsRef.current = { ...definitionsRef.current, meditated: restored };
                    onDefinitionUpdated(restored);
                    setActionError('Could not update Stats page visibility. Please try again.');
                }
            });
    };

    const handleOpenRecurringTask = (event: MouseEvent<HTMLButtonElement>) => {
        if (recurringTaskLoading || recurringTaskSaving) return;
        setRecurringTaskError(null);
        setActionError(null);
        const anchorPosition = popupPositionForElement(event.currentTarget);
        if (!definitions.meditated.recurringTaskSeriesId) {
            setRecurringTaskMode('create');
            setRecurringTaskInitialDraft(null);
            setRecurringTaskAnchorPosition(anchorPosition);
            return;
        }

        setRecurringTaskLoading(true);
        void statService.getRecurringTask(definitions.meditated.id)
            .then(series => {
                const defaultDays = defaultStatRecurringTaskDraft().recurrenceDaysOfWeek;
                setRecurringTaskMode('update');
                setRecurringTaskInitialDraft({
                    recurrenceFrequency: series.recurrenceFrequency,
                    recurrenceDaysOfWeek: series.recurrenceDaysOfWeek?.length
                        ? series.recurrenceDaysOfWeek
                        : defaultDays,
                    timeOfDay: timeOfDayFromDateTime(series.startDateTime),
                    importance: series.importance,
                });
                setRecurringTaskAnchorPosition(anchorPosition);
            })
            .catch(loadError => {
                console.error('Failed to load meditation recurring task schedule:', loadError);
                setActionError('Could not load the recurring task schedule. Please try again.');
            })
            .finally(() => setRecurringTaskLoading(false));
    };

    const handleSaveRecurringTask = (draft: StatRecurringTaskDraft) => {
        if (recurringTaskSaving) return;
        const previous = definitions.meditated;
        const isCreating = recurringTaskMode === 'create';
        setRecurringTaskSaving(true);
        setRecurringTaskError(null);
        if (isCreating) {
            setRecurringTaskInitialDraft(draft);
            setRecurringTaskAnchorPosition(null);
            onDefinitionUpdated({
                ...previous,
                recurringTaskSeriesId: `optimistic-series-${Date.now()}`,
                focusTaskName: 'Meditate',
                focusTaskNames: ['Meditate'],
            });
        }
        const taskDraft = { ...draft, taskName: 'Meditate' };
        const save = isCreating
            ? statService.createRecurringTask(previous.id, taskDraft)
            : statService.updateRecurringTask(previous.id, taskDraft);
        void save
            .then(updated => {
                onDefinitionUpdated(updated);
                setRecurringTaskAnchorPosition(null);
                setRecurringTaskInitialDraft(null);
            })
            .catch(saveError => {
                console.error('Failed to save meditation recurring task:', saveError);
                if (isCreating) {
                    onDefinitionUpdated(previous);
                    setRecurringTaskAnchorPosition(recurringTaskAnchorPosition);
                }
                setRecurringTaskError('Could not save the recurring task. Please try again.');
            })
            .finally(() => setRecurringTaskSaving(false));
    };

    return (
        <>
            <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                spacing={2}
                sx={{
                    pt: 1.5,
                    borderTop: theme => `1px solid ${theme.palette.divider}`,
                    flexWrap: 'wrap',
                    rowGap: 1,
                }}
            >
                <FormControlLabel
                    control={(
                        <Switch
                            size="small"
                            checked={Boolean(definitions.meditated.showOnStatsPage)}
                            onChange={event => handleStatsVisibilityChange(event.target.checked)}
                            inputProps={{ 'aria-label': 'Show Meditate on Stats page' }}
                        />
                    )}
                    label={<Typography variant="body2" noWrap>Show on Stats page</Typography>}
                    sx={{
                        ml: 0,
                        mr: 0,
                        minWidth: 0,
                        flexShrink: 0,
                        whiteSpace: 'nowrap',
                        '& .MuiFormControlLabel-label': { whiteSpace: 'nowrap' },
                    }}
                />
                <Button
                    size="medium"
                    variant="outlined"
                    disabled={recurringTaskLoading || recurringTaskSaving}
                    onClick={handleOpenRecurringTask}
                    sx={{ whiteSpace: 'nowrap', textTransform: 'none' }}
                >
                    {definitions.meditated.recurringTaskSeriesId
                        ? 'Edit schedule'
                        : 'Create task'}
                </Button>
            </Stack>
            {actionError && <Alert severity="warning" onClose={() => setActionError(null)}>{actionError}</Alert>}
            <StatRecurringTaskDialog
                open={Boolean(recurringTaskAnchorPosition)}
                definition={definitions.meditated}
                anchorPosition={recurringTaskAnchorPosition}
                initialDraft={recurringTaskInitialDraft}
                saving={recurringTaskSaving}
                error={recurringTaskError}
                title={recurringTaskMode === 'update'
                    ? 'Change recurring task schedule'
                    : 'Create recurring task'}
                confirmLabel={recurringTaskMode === 'update' ? 'Save schedule' : 'Create task'}
                onClose={() => {
                    if (recurringTaskSaving) return;
                    setRecurringTaskAnchorPosition(null);
                    setRecurringTaskInitialDraft(null);
                    setRecurringTaskError(null);
                }}
                onConfirm={handleSaveRecurringTask}
            />
        </>
    );
}
