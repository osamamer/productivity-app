import { useMemo, useState } from 'react';
import {
    Avatar, Box, InputAdornment, List, ListItemAvatar, ListItemButton, ListItemText, Paper, TextField, Typography,
} from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import HourglassTopRoundedIcon from '@mui/icons-material/HourglassTopRounded';
import type { DesktopTimeouts, TimedApp } from '../../services/desktop';
import { AppPauseEditor } from './AppPauseEditor';
import { describeAppPause } from './boundaryText';
import { BoundarySectionHeader } from './BoundarySection';
import { sectionPaperSx } from './boundaryStyles';

interface AppPausesSectionProps {
    apps: TimedApp[];
    timeouts: DesktopTimeouts;
    onChanged: (message: string) => void;
    onError: (message: string) => void;
}

export function AppPausesSection({ apps, timeouts, onChanged, onError }: AppPausesSectionProps) {
    const [query, setQuery] = useState('');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const selected = apps.find(app => app.id === selectedId) ?? null;
    const paused = apps.filter(app => app.settings).length;

    const visible = useMemo(() => {
        const needle = query.trim().toLocaleLowerCase();
        const matches = needle
            ? apps.filter(app => `${app.name} ${app.aliases.join(' ')}`.toLocaleLowerCase().includes(needle))
            : apps;
        // Apps with a pause first, then alphabetical (the shell already sorts by name).
        return [...matches].sort((a, b) => Number(!a.settings) - Number(!b.settings));
    }, [apps, query]);

    return (
        <Paper elevation={0} sx={sectionPaperSx}>
            <BoundarySectionHeader
                Icon={HourglassTopRoundedIcon}
                title="App pauses"
                description={`A short, focused countdown before an app opens, and an optional time limit once it's open. ${paused ? `${paused} app${paused === 1 ? '' : 's'} paused.` : ''}`}
            />
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(260px, 340px) 1fr' }, gap: { xs: 2, md: 3 } }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, minWidth: 0 }}>
                    <TextField
                        size="small"
                        placeholder="Search installed apps"
                        value={query}
                        onChange={event => setQuery(event.target.value)}
                        InputProps={{ startAdornment: <InputAdornment position="start"><SearchRoundedIcon fontSize="small" /></InputAdornment> }}
                    />
                    <List
                        dense
                        aria-label="Installed apps"
                        sx={{ maxHeight: 440, overflowY: 'auto', border: 1, borderColor: 'divider', borderRadius: 2, py: 0.5 }}
                    >
                        {visible.map(app => (
                            <ListItemButton
                                key={app.id}
                                selected={app.id === selectedId}
                                onClick={() => setSelectedId(app.id)}
                                sx={{ borderRadius: 1.5, mx: 0.5, '&.Mui-selected': { bgcolor: 'action.selected' } }}
                            >
                                <ListItemAvatar sx={{ minWidth: 44 }}>
                                    <Avatar variant="rounded" src={app.icon ?? undefined} alt="" sx={{ width: 30, height: 30, bgcolor: 'action.hover', color: 'text.secondary', fontSize: 14, borderRadius: 1.5 }}>
                                        {app.name.slice(0, 1)}
                                    </Avatar>
                                </ListItemAvatar>
                                <ListItemText
                                    primary={app.name}
                                    secondary={describeAppPause(app.settings)}
                                    primaryTypographyProps={{ noWrap: true, fontWeight: app.settings ? 600 : 400 }}
                                    secondaryTypographyProps={{ noWrap: true, color: app.settings ? 'primary.main' : 'text.secondary' }}
                                />
                            </ListItemButton>
                        ))}
                        {!visible.length && (
                            <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>No apps match.</Typography>
                        )}
                    </List>
                </Box>
                <Box sx={{ minWidth: 0 }}>
                    {selected ? (
                        <AppPauseEditor key={selected.id} app={selected} timeouts={timeouts} onSaved={onChanged} onError={onError} />
                    ) : (
                        <Box sx={{ height: '100%', minHeight: 180, display: 'grid', placeItems: 'center', border: 1, borderStyle: 'dashed', borderColor: 'divider', borderRadius: 2, p: 3 }}>
                            <Typography color="text.secondary" textAlign="center">
                                Choose an app to give it a pause.
                            </Typography>
                        </Box>
                    )}
                </Box>
            </Box>
        </Paper>
    );
}
