import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Alert, Box, Button, Stack, Switch, Typography } from '@mui/material';
import {
    backupRevision, backupsEnabled, openBackup, readBackup, refreshBackup,
    setBackupsEnabled, subscribeBackups,
} from '../../services/backup/localBackup';

export default function LocalBackupSection() {
    const actionVersion = useRef(0);
    const revision = useSyncExternalStore(subscribeBackups, backupRevision);
    const [enabled, setEnabled] = useState(backupsEnabled);
    const [capturedAt, setCapturedAt] = useState<string>();
    const [error, setError] = useState<string>();
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        let active = true;
        setEnabled(backupsEnabled());
        void readBackup().then(snapshot => {
            if (active) setCapturedAt(snapshot?.capturedAt);
        }).catch(cause => {
            console.error('Could not read local backup:', cause);
            if (active) setError('Local storage is unavailable. Check your device’s storage and browser settings.');
        });
        return () => { active = false; };
    }, [revision]);

    async function refresh() {
        const version = ++actionVersion.current;
        setRefreshing(true);
        setError(undefined);
        try { await refreshBackup(true); }
        catch (cause) {
            console.error('Could not refresh local backup:', cause);
            if (version === actionVersion.current) setError('Could not refresh the backup. Your previous copy is still available. We’ll retry when the app reconnects.');
        } finally { if (version === actionVersion.current) setRefreshing(false); }
    }

    async function toggle(value: boolean) {
        const version = ++actionVersion.current;
        setRefreshing(false);
        setEnabled(value);
        setError(undefined);
        try {
            await setBackupsEnabled(value);
            if (value && version === actionVersion.current) await refresh();
        } catch (cause) {
            console.error('Could not change local backup setting:', cause);
            if (version !== actionVersion.current) return;
            setEnabled(backupsEnabled());
            setError('Could not update local backups. Check your device’s storage and try again.');
        }
    }

    async function view(download = false) {
        try { await openBackup(download); }
        catch (cause) {
            console.error('Could not open local backup:', cause);
            setError('The backup could not be opened. Try refreshing it.');
        }
    }

    return <Box sx={{ mt: 3, pt: 3, borderTop: 1, borderColor: 'divider', textAlign: 'left' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography component="label" htmlFor="local-backup-toggle" variant="subtitle2">Local backups on this device</Typography>
            <Switch id="local-backup-toggle" checked={enabled} onChange={(_, value) => { void toggle(value); }} />
        </Stack>
        <Typography variant="body2" color="text.secondary">
            Keep a view-only fallback of your saved records and preferences. Refreshes daily while the app is open,
            and catches up when you return. In cloud mode, the cloud always replaces the local copy.
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Includes secret statistics. Uploaded audio and calendar subscription credentials are excluded.
            This copy stays in this browser or desktop app. Turning backups off removes it.
        </Typography>
        {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
        {enabled && <>
            <Typography variant="body2" sx={{ mt: 1.5 }} role="status">
                {capturedAt ? `Last backup: ${new Date(capturedAt).toLocaleString()}` : 'No backup saved yet.'}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
                <Button onClick={() => { void refresh(); }} disabled={refreshing}>{refreshing ? 'Refreshing…' : 'Back up now'}</Button>
                <Button onClick={() => { void view(); }} disabled={!capturedAt}>View backup</Button>
                <Button onClick={() => { void view(true); }} disabled={!capturedAt}>Download offline copy</Button>
            </Stack>
            <Typography variant="caption" color="text.secondary">
                Download a copy to open even when the app cannot load. Clearing this app’s storage removes its saved backup.
            </Typography>
        </>}
    </Box>;
}
