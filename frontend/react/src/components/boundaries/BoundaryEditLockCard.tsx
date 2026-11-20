import { useEffect, useState, type FormEvent } from 'react';
import { Box, Button, LinearProgress, Paper, TextField } from '@mui/material';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import LockOpenRoundedIcon from '@mui/icons-material/LockOpenRounded';
import { BoundarySectionHeader } from './BoundarySection';
import { sectionPaperSx } from './boundaryStyles';
import type { BoundaryEditLock } from './useBoundaryEditLock';

const MIN_LENGTH = 8;

interface BoundaryEditLockCardProps {
    lock: BoundaryEditLock;
    onError: (message: string) => void;
}

const buttonSx = { borderRadius: 2, textTransform: 'none', fontWeight: 700, px: 2.5 } as const;

function messageOf(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}

/** Set the first password, unlock with the password and a ten second wait, or lock again. */
export function BoundaryEditLockCard({ lock, onError }: BoundaryEditLockCardProps) {
    const { status } = lock;
    if (!lock.supported || !status) return null;
    if (!status.hasPassword) return <NewPassword lock={lock} onError={onError} />;
    if (lock.editable) return <Unlocked lock={lock} onError={onError} />;
    if (status.readyAt > Date.now()) return <Waiting readyAt={status.readyAt} waitMs={status.waitMs} />;
    return <Locked lock={lock} onError={onError} />;
}

function PasswordForm({ label, submitLabel, confirm, onSubmit }: {
    label: string;
    submitLabel: string;
    confirm?: boolean;
    onSubmit: (password: string) => Promise<void>;
}) {
    const [password, setPassword] = useState('');
    const [repeat, setRepeat] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        if (confirm && password.length < MIN_LENGTH) return setError(`At least ${MIN_LENGTH} characters.`);
        if (confirm && password !== repeat) return setError('The passwords differ.');
        setBusy(true);
        setError(null);
        try {
            await onSubmit(password);
        } catch (cause) {
            setError(messageOf(cause));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Box component="form" onSubmit={submit} sx={{ display: 'flex', gap: 1.25, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <TextField
                type="password"
                size="small"
                label={label}
                value={password}
                autoComplete={confirm ? 'new-password' : 'current-password'}
                onChange={event => setPassword(event.target.value)}
                error={error !== null}
                helperText={error ?? ' '}
                sx={{ minWidth: 220 }}
            />
            {confirm && (
                <TextField
                    type="password"
                    size="small"
                    label="Repeat it"
                    value={repeat}
                    autoComplete="new-password"
                    onChange={event => setRepeat(event.target.value)}
                    helperText=" "
                    sx={{ minWidth: 220 }}
                />
            )}
            <Button type="submit" variant="contained" disableElevation disabled={busy || !password} sx={buttonSx}>{submitLabel}</Button>
        </Box>
    );
}

function NewPassword({ lock }: BoundaryEditLockCardProps) {
    return (
        <Paper elevation={0} sx={sectionPaperSx}>
            <BoundarySectionHeader
                Icon={LockRoundedIcon}
                title="Protect your boundaries"
                description="Choose a password. From then on, changing a boundary needs the password and a ten second wait."
            />
            <PasswordForm label="New password" submitLabel="Set password" confirm onSubmit={lock.setPassword} />
        </Paper>
    );
}

function Locked({ lock }: BoundaryEditLockCardProps) {
    return (
        <Paper elevation={0} sx={sectionPaperSx}>
            <BoundarySectionHeader
                Icon={LockRoundedIcon}
                title="Boundaries are locked"
                description="Enter your password, then wait ten seconds, to change them."
            />
            <PasswordForm label="Password" submitLabel="Unlock" onSubmit={lock.unlock} />
        </Paper>
    );
}

function Waiting({ readyAt, waitMs }: { readyAt: number; waitMs: number }) {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 100);
        return () => window.clearInterval(timer);
    }, []);
    const left = Math.max(0, readyAt - now);
    return (
        <Paper elevation={0} sx={sectionPaperSx}>
            <BoundarySectionHeader
                Icon={LockRoundedIcon}
                title={`Unlocking in ${Math.ceil(left / 1000)} s`}
                description="A moment to be sure you want to change this."
            />
            <LinearProgress variant="determinate" value={100 * (1 - left / waitMs)} sx={{ borderRadius: 1, height: 6 }} />
        </Paper>
    );
}

function Unlocked({ lock, onError }: BoundaryEditLockCardProps) {
    const [changing, setChanging] = useState(false);
    const until = new Date(lock.status?.unlockedUntil ?? 0).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return (
        <Paper elevation={0} sx={sectionPaperSx}>
            <BoundarySectionHeader
                Icon={LockOpenRoundedIcon}
                title="Unlocked for changes"
                description={`Boundaries lock again at ${until}, or when you leave this page.`}
            />
            <Box sx={{ display: 'flex', gap: 1.25, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <Button variant="outlined" color="inherit" onClick={() => void lock.lock().catch(error => onError(messageOf(error)))} sx={buttonSx}>
                    Lock now
                </Button>
                {!changing && (
                    <Button color="inherit" onClick={() => setChanging(true)} sx={{ ...buttonSx, fontWeight: 400 }}>Change password</Button>
                )}
            </Box>
            {changing && (
                <Box sx={{ mt: 2 }}>
                    <PasswordForm
                        label="New password"
                        submitLabel="Save password"
                        confirm
                        onSubmit={async password => {
                            await lock.setPassword(password);
                            setChanging(false);
                        }}
                    />
                </Box>
            )}
        </Paper>
    );
}
