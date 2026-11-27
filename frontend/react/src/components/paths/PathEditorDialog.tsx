import AddRoundedIcon from '@mui/icons-material/AddRounded';
import {
    Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, MenuItem,
    Switch, TextField, Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { pathService } from '../../services/api/pathService';
import { statService } from '../../services/api/statService';
import type { StatDefinition } from '../../types/Stats';
import { PATH_ICONS, type Path, type SignalCombine, type WeekStrength } from '../../types/Path';
import { PATH_COLORS, PATH_ICON_COMPONENTS } from './pathIcons';
import { emptyForm, formFromPath, newInput, statOptions, toSignalDraft, type PathForm } from './pathDraft';
import { SignalInputFields } from './SignalInputFields';
import { SignalPreviewBars } from './SignalPreviewBars';

interface Props {
    /** The path to edit, or null to create one. */
    path: Path | null;
    existingPaths: number;
    today: string;
    onClose: () => void;
    onSaved: () => void;
}

const COMBINE_OPTIONS: { value: SignalCombine; label: string }[] = [
    { value: 'AVERAGE', label: 'Average of the inputs (weighted)' },
    { value: 'WEAKEST', label: 'The weakest input' },
    { value: 'ALL_MET', label: 'Share of inputs met' },
];
const PREVIEW_DELAY_MS = 400;

/** Creates or edits a path and its signal, with a preview of how recent weeks would have scored. */
export function PathEditorDialog({ path, existingPaths, today, onClose, onSaved }: Props) {
    const [form, setForm] = useState<PathForm>(() => (path ? formFromPath(path) : emptyForm(existingPaths)));
    const [definitions, setDefinitions] = useState<StatDefinition[]>(() => statService.getCachedDefinitions() ?? []);
    const [preview, setPreview] = useState<WeekStrength[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const options = useMemo(() => statOptions(definitions, statService.hasSecretStatsAccess()), [definitions]);
    const draft = useMemo(() => toSignalDraft(form, definitions), [form, definitions]);

    useEffect(() => {
        statService.getDefinitions()
            .then(setDefinitions)
            .catch(loadError => console.error('Could not load stats for the path editor:', loadError));
    }, []);

    useEffect(() => {
        if (typeof draft === 'string') {
            setPreview(null);
            return undefined;
        }
        let cancelled = false;
        const timer = window.setTimeout(() => {
            pathService.previewSignal(draft, today)
                .then(result => { if (!cancelled) setPreview(result.weeks); })
                .catch(previewError => console.warn('Could not preview the signal:', previewError));
        }, PREVIEW_DELAY_MS);
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [draft, today]);

    const update = (change: Partial<PathForm>) => setForm(current => ({ ...current, ...change }));

    const save = async () => {
        if (!form.name.trim()) return setError('Give the path a name.');
        if (typeof draft === 'string') return setError(draft);
        setSaving(true);
        setError(null);
        try {
            const fields = { name: form.name.trim(), color: form.color, icon: form.icon, paused: form.paused, signal: draft };
            if (path) await pathService.updatePath(path.id, fields);
            else await pathService.createPath(fields);
            onSaved();
        } catch (saveError) {
            console.error('Could not save the path:', saveError);
            setError(saveError instanceof Error ? saveError.message : 'Could not save the path.');
        } finally {
            setSaving(false);
        }
    };

    const remove = async () => {
        if (!path) return;
        if (!confirmDelete) return setConfirmDelete(true);
        setSaving(true);
        try {
            await pathService.deletePath(path.id);
            onSaved();
        } catch (deleteError) {
            console.error('Could not delete the path:', deleteError);
            setError('Could not delete the path.');
            setSaving(false);
        }
    };

    const firstUnused = options.find(option => !form.inputs.some(input => input.statDefinitionId === option.definition.id)) ?? options[0];

    return (
        <Dialog open onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="path-editor-title">
            <DialogTitle id="path-editor-title">{path ? `Edit ${path.name}` : 'New path'}</DialogTitle>
            <DialogContent sx={{ display: 'grid', gap: 2, pt: '8px !important' }}>
                <TextField label="Name" value={form.name} autoFocus={!path} inputProps={{ maxLength: 60 }}
                           placeholder="Writer, Body, Money…" onChange={event => update({ name: event.target.value })} />
                <Box>
                    <Typography variant="caption" color="text.secondary">Colour</Typography>
                    <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                        {PATH_COLORS.map(color => (
                            <Box key={color} component="button" type="button" aria-label={`Colour ${color}`} aria-pressed={form.color === color}
                                 onClick={() => update({ color })}
                                 sx={{
                                     width: 28, height: 28, borderRadius: '50%', border: 0, cursor: 'pointer', background: color,
                                     outline: form.color === color ? '2px solid' : 'none', outlineColor: 'text.primary', outlineOffset: 2,
                                 }} />
                        ))}
                    </Box>
                </Box>
                <Box>
                    <Typography variant="caption" color="text.secondary">Icon</Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                        {PATH_ICONS.map(icon => {
                            const Icon = PATH_ICON_COMPONENTS[icon];
                            return (
                                <IconButton key={icon} size="small" aria-label={`Icon ${icon}`} aria-pressed={form.icon === icon}
                                            onClick={() => update({ icon })}
                                            sx={{ color: form.icon === icon ? form.color : 'text.secondary', bgcolor: form.icon === icon ? 'action.selected' : undefined }}>
                                    <Icon fontSize="small" />
                                </IconButton>
                            );
                        })}
                    </Box>
                </Box>

                <Box sx={{ display: 'grid', gap: 1.25 }}>
                    <Box>
                        <Typography variant="subtitle2" fontWeight={700}>Signal</Typography>
                        <Typography variant="caption" color="text.secondary">
                            Built from stats you already log. Each week gets a strength; a fully kept week is 100%.
                        </Typography>
                    </Box>
                    {form.inputs.map((input, index) => (
                        <SignalInputFields
                            key={index}
                            input={input}
                            options={options}
                            showWeight={form.inputs.length > 1 && form.combineMethod === 'AVERAGE'}
                            onChange={next => update({ inputs: form.inputs.map((item, at) => (at === index ? next : item)) })}
                            onRemove={() => update({ inputs: form.inputs.filter((_, at) => at !== index) })}
                        />
                    ))}
                    {options.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">Create a stat on the Statistics page first; signals are built from stats.</Typography>
                    ) : (
                        <Button size="small" startIcon={<AddRoundedIcon />} sx={{ justifySelf: 'start', textTransform: 'none' }}
                                disabled={form.inputs.length >= 8}
                                onClick={() => update({ inputs: [...form.inputs, newInput(firstUnused.definition)] })}>
                            {form.inputs.length === 0 ? 'Add a stat' : 'Add another stat'}
                        </Button>
                    )}
                    {form.inputs.length > 1 && (
                        <TextField select size="small" label="Combine inputs" value={form.combineMethod}
                                   onChange={event => update({ combineMethod: event.target.value as SignalCombine })}>
                            {COMBINE_OPTIONS.map(option => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
                        </TextField>
                    )}
                    {preview && <SignalPreviewBars weeks={preview} color={form.color} />}
                </Box>

                {path && (
                    <FormControlLabel control={<Switch checked={form.paused} onChange={event => update({ paused: event.target.checked })} />}
                                      label="Paused (drawn dimmed)" />
                )}
                {error && <Alert severity="error">{error}</Alert>}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                {path && (
                    <Button color="error" onClick={remove} disabled={saving} sx={{ mr: 'auto', textTransform: 'none' }}>
                        {confirmDelete ? 'Delete for good' : 'Delete path'}
                    </Button>
                )}
                <Button onClick={onClose} sx={{ textTransform: 'none' }}>Cancel</Button>
                <Button variant="contained" onClick={save} disabled={saving} sx={{ textTransform: 'none', fontWeight: 700 }}>
                    {path ? 'Save' : 'Create path'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
