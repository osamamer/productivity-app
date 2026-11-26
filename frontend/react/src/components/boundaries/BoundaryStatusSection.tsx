import { useEffect, useMemo, useState } from 'react';
import { Avatar, Box, LinearProgress, Paper, Typography } from '@mui/material';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import LanguageRoundedIcon from '@mui/icons-material/LanguageRounded';
import type { TimeoutState } from '../../services/desktop';
import { BoundarySectionHeader } from './BoundarySection';
import { sectionPaperSx } from './boundaryStyles';
import { boundaryStatusRows, type BoundaryStatusRow } from './boundaryStatus';
import { formatDuration } from './boundaryText';

const TICK_MS = 1000;

/** Where every limited app and site stands today: time left, the running session, opens. */
export function BoundaryStatusSection({ state }: { state: TimeoutState }) {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const interval = window.setInterval(() => setNow(Date.now()), TICK_MS);
        return () => window.clearInterval(interval);
    }, []);
    const rows = useMemo(() => boundaryStatusRows(state, now), [state, now]);
    if (!rows.length) return null;

    return (
        <Paper elevation={0} sx={sectionPaperSx}>
            <BoundarySectionHeader
                Icon={InsightsRoundedIcon}
                title="Today"
                description="Time left today, the session running now and how many sessions started, for every app and site with a limit."
            />
            <Box component="ul" aria-label="Boundary status" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1 }}>
                {rows.map(row => <StatusRow key={row.key} row={row} />)}
            </Box>
        </Paper>
    );
}

function StatusRow({ row }: { row: BoundaryStatusRow }) {
    return (
        <Box
            component="li"
            aria-label={row.name}
            sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '36px 1fr', md: '36px minmax(140px, 1fr) minmax(180px, 1.4fr) minmax(160px, 1.2fr) auto' },
                alignItems: 'center',
                columnGap: 1.5,
                rowGap: 0.5,
                p: 1.25,
                border: 1,
                borderColor: 'divider',
                borderRadius: 2,
            }}
        >
            <Avatar variant="rounded" src={row.icon ?? undefined} alt="" sx={{ width: 30, height: 30, bgcolor: 'action.hover', color: 'text.secondary', fontSize: 14, borderRadius: 1.5 }}>
                {row.key.startsWith('site:') ? <LanguageRoundedIcon fontSize="small" /> : row.name.slice(0, 1)}
            </Avatar>
            <Typography fontWeight={600} noWrap>{row.name}</Typography>
            <Box sx={{ gridColumn: { xs: '2', md: 'auto' }, minWidth: 0 }}>
                {row.daily ? (
                    <>
                        <Typography variant="body2" color="text.secondary" noWrap>
                            {row.daily.leftSeconds > 0
                                ? `${formatDuration(Math.ceil(row.daily.leftSeconds))} left of ${formatDuration(row.daily.limitSeconds)} today`
                                : 'Done for today'}
                        </Typography>
                        <LinearProgress
                            variant="determinate"
                            value={Math.min(100, (row.daily.usedSeconds / row.daily.limitSeconds) * 100)}
                            aria-label={`${row.name} daily time used`}
                            sx={{ mt: 0.5, height: 6, borderRadius: 3 }}
                        />
                    </>
                ) : (
                    <Typography variant="body2" color="text.secondary">No daily limit</Typography>
                )}
            </Box>
            <Typography
                variant="body2"
                noWrap
                color={row.live ? 'primary.main' : 'text.secondary'}
                sx={{ gridColumn: { xs: '2', md: 'auto' }, fontVariantNumeric: 'tabular-nums', fontWeight: row.live ? 600 : 400 }}
            >
                {row.session ?? 'No session timer'}
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap sx={{ gridColumn: { xs: '2', md: 'auto' } }}>
                {row.opensLabel} today
            </Typography>
        </Box>
    );
}
