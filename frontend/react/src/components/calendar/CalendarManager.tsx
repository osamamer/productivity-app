import {
    Alert, Box, Button, ButtonBase, Checkbox, Fade, Popover, Stack, TextField, Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { useRef, useState } from 'react';
import { CALENDAR_COLORS, Calendar, CalendarColor, CalendarUpdate, calendarColorHex } from '../../types/Calendar';
import { CalendarSource } from '../../services/api/calendarSourceService';

type Props = {
    calendars: Calendar[];
    sources: CalendarSource[];
    onImportUrl: (name: string, color: CalendarColor, url: string) => Promise<void>;
    onImportFile: (name: string, color: CalendarColor, file: File) => Promise<void>;
    onSyncSource: (sourceId: string) => Promise<void>;
    onUpdate: (calendarId: string, update: CalendarUpdate) => Promise<void>;
    onCreate: (name: string, color: CalendarColor) => Promise<void>;
    onDelete: (calendarId: string) => Promise<void>;
};

export function CalendarManager({ calendars, sources, onImportUrl, onImportFile, onSyncSource, onUpdate, onCreate, onDelete }: Props) {
    const theme = useTheme();
    const buttonRef = useRef<HTMLButtonElement | null>(null);
    const [anchor, setAnchor] = useState<HTMLElement | null>(null);
    const [createOpen, setCreateOpen] = useState(false);
    const [importOpen, setImportOpen] = useState(false);
    const [importName, setImportName] = useState('');
    const [importColor, setImportColor] = useState<CalendarColor>('accent');
    const [importUrl, setImportUrl] = useState('');
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importMode, setImportMode] = useState<'url' | 'file'>('url');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [name, setName] = useState('');
    const [color, setColor] = useState<CalendarColor>('accent');
    const [newName, setNewName] = useState('');
    const [newColor, setNewColor] = useState<CalendarColor>('accent');
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const beginEdit = (calendar: Calendar) => {
        setEditingId(calendar.id);
        setName(calendar.name);
        setColor(calendar.color);
        setConfirmingDelete(false);
        setError(null);
    };

    const saveEdit = async (calendar: Calendar) => {
        if (!name.trim()) {
            setError('Enter a calendar name.');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            await onUpdate(calendar.id, { name: name.trim(), color });
            setEditingId(null);
        } catch {
            setError('Could not save calendar changes. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const createCalendar = async () => {
        if (!newName.trim()) {
            setError('Enter a calendar name.');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            await onCreate(newName.trim(), newColor);
            setNewName('');
            setNewColor('accent');
            setCreateOpen(false);
        } catch {
            setError('Could not create calendar. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const deleteCalendar = async (calendar: Calendar) => {
        setSaving(true);
        setError(null);
        try {
            await onDelete(calendar.id);
            setEditingId(null);
            setConfirmingDelete(false);
        } catch {
            setError('Could not delete calendar. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const openCreatePopup = () => {
        setError(null);
        setEditingId(null);
        setConfirmingDelete(false);
        setAnchor(null);
        window.setTimeout(() => setCreateOpen(true), 140);
    };

    const openImportPopup = () => {
        setError(null);
        setAnchor(null);
        window.setTimeout(() => setImportOpen(true), 140);
    };

    const importCalendar = async () => {
        if (!importName.trim() || (importMode === 'url' ? !importUrl.trim() : !importFile)) {
            setError('Enter a name and choose a calendar source.');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            if (importMode === 'url') await onImportUrl(importName.trim(), importColor, importUrl.trim());
            else await onImportFile(importName.trim(), importColor, importFile!);
            setImportOpen(false);
            setImportName('');
            setImportUrl('');
            setImportFile(null);
        } catch {
            setError('Could not import this calendar. Check the source and try again.');
        } finally {
            setSaving(false);
        }
    };

    const syncSource = async (sourceId: string) => {
        setSaving(true);
        setError(null);
        try { await onSyncSource(sourceId); }
        catch { setError('Could not refresh this calendar. Try again later.'); }
        finally { setSaving(false); }
    };

    const closeCalendarList = () => {
        setAnchor(null);
        setEditingId(null);
        setConfirmingDelete(false);
        setError(null);
    };

    const colorOptions = CALENDAR_COLORS.map(option => ({
        ...option,
        hex: calendarColorHex(option.value, theme.palette.primary.main),
    }));

    const colorField = (value: CalendarColor, onChange: (next: CalendarColor) => void) => (
        <Stack spacing={0.75}>
            <Typography variant="caption" color="text.secondary">Color</Typography>
            <Stack direction="row" flexWrap="wrap" gap={0.75} role="radiogroup" aria-label="Calendar color">
                {colorOptions.map(option => (
                    <ButtonBase
                        key={option.value}
                        aria-label={option.label}
                        aria-pressed={value === option.value}
                        title={option.label}
                        onClick={() => onChange(option.value)}
                        sx={{
                            width: 54,
                            minHeight: 48,
                            borderRadius: 1.25,
                            border: '1px solid',
                            borderColor: value === option.value ? 'text.primary' : 'transparent',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 0.25,
                        }}
                    >
                        <Box sx={{ width: 21, height: 21, borderRadius: '50%', bgcolor: option.hex }} />
                        <Typography variant="caption" sx={{ lineHeight: 1.1 }}>{option.label}</Typography>
                    </ButtonBase>
                ))}
            </Stack>
        </Stack>
    );

    return (
        <>
            <Button
                ref={buttonRef}
                size="small"
                variant="outlined"
                startIcon={<CalendarMonthRoundedIcon />}
                onClick={event => setAnchor(event.currentTarget)}
                aria-label="Manage calendars"
            >
                Calendars
            </Button>
            <Popover
                open={Boolean(anchor)}
                anchorEl={anchor}
                onClose={closeCalendarList}
                TransitionComponent={Fade}
                transitionDuration={{ enter: 150, exit: 100 }}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                slotProps={{ paper: { sx: { width: 340, maxWidth: 'calc(100vw - 24px)', p: 1.5, borderRadius: 2.5 } } }}
            >
                <Stack spacing={1.25}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Typography variant="subtitle2" fontWeight={700}>Calendars</Typography>
                        <Stack direction="row">
                            <Button size="small" onClick={openImportPopup}>Import</Button>
                            <Button size="small" startIcon={<AddRoundedIcon />} onClick={openCreatePopup}>Add calendar</Button>
                        </Stack>
                    </Stack>
                    {calendars.map(calendar => {
                        const source = sources.find(item => item.calendarId === calendar.id);
                        return (
                        <Box key={calendar.id} sx={{ borderBottom: theme => `1px solid ${theme.palette.divider}`, pb: 1 }}>
                            {source && (
                                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ pl: 4 }}>
                                    <Typography variant="caption" color="text.secondary">
                                        {source.type === 'ICS_URL' ? 'Subscribed calendar' : 'Imported file'}
                                        {source.lastError ? ' · Refresh failed' : source.lastSyncedAt ? ` · Updated ${new Date(source.lastSyncedAt).toLocaleString()}` : ''}
                                    </Typography>
                                    {source.type === 'ICS_URL' && <Button size="small" disabled={saving} onClick={() => void syncSource(source.id)}>Sync</Button>}
                                </Stack>
                            )}
                            {editingId === calendar.id ? (
                                <Stack spacing={1}>
                                    <TextField label="Name" value={name} onChange={event => setName(event.target.value)} size="small" />
                                    {colorField(color, setColor)}
                                    {confirmingDelete ? (
                                        <>
                                            <Typography variant="caption" color="text.secondary">
                                                {sources.some(source => source.calendarId === calendar.id)
                                                    ? 'Imported events from this source will be removed. Local tasks and events stay in the app.'
                                                    : 'Its tasks and events stay in the app, but disappear from calendar views.'}
                                            </Typography>
                                            <Stack direction="row" justifyContent="flex-end" spacing={1}>
                                                <Button size="small" onClick={() => setConfirmingDelete(false)}>Keep calendar</Button>
                                                <Button size="small" color="error" variant="contained" disabled={saving} onClick={() => void deleteCalendar(calendar)}>Delete</Button>
                                            </Stack>
                                        </>
                                    ) : (
                                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                                            {!calendar.defaultCalendar && (
                                                <Button size="small" color="error" onClick={() => setConfirmingDelete(true)}>Delete</Button>
                                            )}
                                            <Box sx={{ flex: 1 }} />
                                            <Button size="small" onClick={() => { setEditingId(null); setConfirmingDelete(false); }}>Cancel</Button>
                                            <Button size="small" variant="contained" disabled={saving} onClick={() => void saveEdit(calendar)}>Save</Button>
                                        </Stack>
                                    )}
                                </Stack>
                            ) : (
                                <Stack direction="row" alignItems="center" spacing={0.5}>
                                    <Checkbox
                                        size="small"
                                        checked={calendar.visible}
                                        sx={{
                                            p: 0.5,
                                            color: calendarColorHex(calendar.color, theme.palette.primary.main),
                                            '&.Mui-checked': {
                                                color: calendarColorHex(calendar.color, theme.palette.primary.main),
                                            },
                                        }}
                                        onChange={event => void onUpdate(calendar.id, { visible: event.target.checked }).catch(() => {
                                            setError('Could not update calendar visibility. Please try again.');
                                        })}
                                        inputProps={{ 'aria-label': `Show ${calendar.name} on calendar` }}
                                    />
                                    <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>
                                        {calendar.name}
                                    </Typography>
                                    <Button size="small" aria-label={`Edit ${calendar.name}`} onClick={() => beginEdit(calendar)}>
                                        <EditOutlinedIcon fontSize="small" />
                                    </Button>
                                </Stack>
                            )}
                        </Box>
                    ); })}
                    {error && !createOpen && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
                </Stack>
            </Popover>
            <Popover
                open={importOpen}
                anchorEl={buttonRef.current}
                onClose={() => setImportOpen(false)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                slotProps={{ paper: { sx: { width: 340, maxWidth: 'calc(100vw - 24px)', p: 1.5, borderRadius: 2.5 } } }}
            >
                <Stack spacing={1.25}>
                    <Typography variant="subtitle2" fontWeight={700}>Import a calendar</Typography>
                    <Stack direction="row" spacing={1}>
                        <Button size="small" variant={importMode === 'url' ? 'contained' : 'outlined'} onClick={() => setImportMode('url')}>Subscribe by URL</Button>
                        <Button size="small" variant={importMode === 'file' ? 'contained' : 'outlined'} onClick={() => setImportMode('file')}>Upload .ics</Button>
                    </Stack>
                    <TextField label="Calendar name" size="small" value={importName} onChange={event => setImportName(event.target.value)} />
                    {colorField(importColor, setImportColor)}
                    {importMode === 'url'
                        ? <TextField label="HTTPS calendar URL" size="small" value={importUrl} onChange={event => setImportUrl(event.target.value)} />
                        : <Button component="label" variant="outlined" size="small">
                            {importFile?.name ?? 'Choose .ics file'}
                            <input hidden type="file" accept=".ics,text/calendar" onChange={event => setImportFile(event.target.files?.[0] ?? null)} />
                        </Button>}
                    {error && <Alert severity="error">{error}</Alert>}
                    <Stack direction="row" justifyContent="flex-end" spacing={1}>
                        <Button size="small" onClick={() => setImportOpen(false)}>Cancel</Button>
                        <Button size="small" variant="contained" disabled={saving} onClick={() => void importCalendar()}>Import</Button>
                    </Stack>
                </Stack>
            </Popover>
            <Popover
                open={createOpen}
                anchorEl={buttonRef.current}
                onClose={() => setCreateOpen(false)}
                TransitionComponent={Fade}
                transitionDuration={{ enter: 150, exit: 100 }}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                slotProps={{ paper: { sx: { width: 340, maxWidth: 'calc(100vw - 24px)', p: 1.5, borderRadius: 2.5 } } }}
            >
                <Stack spacing={1.25}>
                    <Typography variant="subtitle2" fontWeight={700}>Add a calendar</Typography>
                    <TextField label="Name" value={newName} onChange={event => setNewName(event.target.value)} size="small" autoComplete="off" />
                    {colorField(newColor, setNewColor)}
                    {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
                    <Stack direction="row" justifyContent="flex-end" spacing={1}>
                        <Button size="small" onClick={() => setCreateOpen(false)}>Cancel</Button>
                        <Button size="small" variant="contained" startIcon={<AddRoundedIcon />} disabled={saving} onClick={() => void createCalendar()}>
                            Add calendar
                        </Button>
                    </Stack>
                </Stack>
            </Popover>
        </>
    );
}
