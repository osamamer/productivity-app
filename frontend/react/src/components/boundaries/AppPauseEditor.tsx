import { useEffect, useState } from 'react';
import { Alert, Avatar, Box, Button, FormControlLabel, Switch, TextField, Typography } from '@mui/material';
import LockClockRoundedIcon from '@mui/icons-material/LockClockRounded';
import { AppNumberField } from '../input/AppNumberField';
import type { DesktopTimeouts, TimedApp } from '../../services/desktop';
import { DEFAULT_PAUSE_MESSAGE, parseWholeNumber } from './boundaryText';

const LOCK_POLL_MS = 1000;
const MAX_DELAY_SECONDS = 86400;
const MAX_CLOSE_MINUTES = 1440;

interface AppPauseEditorProps {
    app: TimedApp;
    timeouts: DesktopTimeouts;
    onSaved: (message: string) => void;
    onError: (message: string) => void;
}

function useLockReason(timeouts: DesktopTimeouts, appId: string) {
    const [reason, setReason] = useState<string | null>(null);
    useEffect(() => {
        let cancelled = false;
        const check = () => {
            timeouts.lockReason(appId)
                .then(next => { if (!cancelled) setReason(next); })
                .catch(error => console.error('Could not check whether the app is running:', error));
        };
        check();
        const interval = window.setInterval(check, LOCK_POLL_MS);
        return () => {
            cancelled = true;
            window.clearInterval(interval);
        };
    }, [appId, timeouts]);
    return reason;
}

/** Pause and auto-close settings for one app (and every launcher alias of it). */
export function AppPauseEditor({ app, timeouts, onSaved, onError }: AppPauseEditorProps) {
    const settings = app.settings;
    const [delay, setDelay] = useState(String(settings?.delaySeconds ?? 30));
    const [autoOpen, setAutoOpen] = useState(settings?.autoOpen ?? true);
    const [message, setMessage] = useState(settings?.message ?? DEFAULT_PAUSE_MESSAGE);
    const [closeAfter, setCloseAfter] = useState(String(Math.round((settings?.closeAfterSeconds ?? 0) / 60)));
    const [busy, setBusy] = useState(false);
    const lockReason = useLockReason(timeouts, app.id);

    const delaySeconds = parseWholeNumber(delay, 0, MAX_DELAY_SECONDS);
    const closeAfterMinutes = parseWholeNumber(closeAfter, 0, MAX_CLOSE_MINUTES);
    const editable = !lockReason && !busy;
    const valid = delaySeconds !== null && closeAfterMinutes !== null;

    const run = async (action: () => Promise<void>, done: string) => {
        setBusy(true);
        try {
            await action();
            onSaved(done);
        } catch (error) {
            onError(error instanceof Error ? error.message : String(error));
        } finally {
            setBusy(false);
        }
    };

    const save = () => {
        if (delaySeconds === null || closeAfterMinutes === null) return;
        void run(
            () => timeouts.saveApp(app.id, { delaySeconds, autoOpen, message, closeAfterSeconds: closeAfterMinutes * 60 }),
            `Saved the pause for ${app.name}.`,
        );
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.25, textAlign: 'left' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Avatar variant="rounded" src={app.icon ?? undefined} alt="" sx={{ width: 44, height: 44, bgcolor: 'action.hover', color: 'text.secondary', borderRadius: 2.5 }}>
                    {app.name.slice(0, 1)}
                </Avatar>
                <Box sx={{ minWidth: 0 }}>
                    <Typography variant="h6" fontWeight={700} noWrap sx={{ letterSpacing: '-0.01em' }}>{app.name}</Typography>
                    {app.aliases.length > 1 && (
                        <Typography variant="caption" color="text.secondary">
                            Also covers {app.aliases.length - 1} other launcher{app.aliases.length > 2 ? 's' : ''}
                        </Typography>
                    )}
                </Box>
            </Box>

            {lockReason && (
                <Alert severity="info" icon={<LockClockRoundedIcon />} sx={{ borderRadius: 2 }}>{lockReason}</Alert>
            )}

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                <AppNumberField
                    label="Pause before opening"
                    size="small"
                    value={delay}
                    min={0}
                    max={MAX_DELAY_SECONDS}
                    disabled={!editable}
                    error={delaySeconds === null}
                    helperText={delaySeconds === null ? '0 to 86400 seconds' : 'Seconds the window must stay focused'}
                    onChange={event => setDelay(event.target.value)}
                    onStepValueChange={value => setDelay(String(value))}
                />
                <AppNumberField
                    label="Close the app after"
                    size="small"
                    value={closeAfter}
                    min={0}
                    max={MAX_CLOSE_MINUTES}
                    disabled={!editable}
                    error={closeAfterMinutes === null}
                    helperText={closeAfterMinutes === null ? '0 to 1440 minutes' : 'Minutes; 0 keeps it open'}
                    onChange={event => setCloseAfter(event.target.value)}
                    onStepValueChange={value => setCloseAfter(String(value))}
                />
            </Box>

            <TextField
                label="Countdown message"
                size="small"
                value={message}
                disabled={!editable}
                onChange={event => setMessage(event.target.value)}
                inputProps={{ maxLength: 300 }}
                placeholder={DEFAULT_PAUSE_MESSAGE}
            />

            <FormControlLabel
                control={<Switch checked={autoOpen} disabled={!editable} onChange={event => setAutoOpen(event.target.checked)} />}
                label={
                    <Box>
                        <Typography variant="body2" fontWeight={600}>Open automatically when time is up</Typography>
                        <Typography variant="caption" color="text.secondary">
                            Off: you still have to choose to open it after the countdown.
                        </Typography>
                    </Box>
                }
                sx={{ alignItems: 'flex-start', ml: 0, gap: 1, '& .MuiSwitch-root': { mt: -0.5 } }}
            />

            {closeAfterMinutes !== null && closeAfterMinutes > 0 && (
                <Typography variant="caption" color="warning.main">
                    Auto-close ends the app's session; unsaved work may be lost. A small window shows the time left.
                </Typography>
            )}

            <Box sx={{ display: 'flex', gap: 1.25, flexWrap: 'wrap' }}>
                <Button variant="contained" disableElevation disabled={!editable || !valid} onClick={save} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, px: 2.5 }}>
                    {settings ? 'Save pause' : 'Add pause'}
                </Button>
                {settings && (
                    <Button
                        color="inherit"
                        variant="outlined"
                        disabled={!editable}
                        onClick={() => void run(() => timeouts.removeApp(app.id), `Restored the original launcher for ${app.name}.`)}
                        sx={{ borderRadius: 2, textTransform: 'none' }}
                    >
                        Turn off
                    </Button>
                )}
            </Box>

            <Typography variant="caption" color="text.secondary">
                Applies to the app's launchers and their shortcuts. Apps that are already running, or started from a terminal, skip the pause.
            </Typography>
        </Box>
    );
}
