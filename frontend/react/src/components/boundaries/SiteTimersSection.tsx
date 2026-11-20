import { useState } from 'react';
import {
    Box, Button, Chip, IconButton, List, ListItem, ListItemButton, ListItemText, Paper, TextField, Typography,
} from '@mui/material';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { AppNumberField } from '../input/AppNumberField';
import type { DesktopTimeouts, SiteTimer, TimeoutState } from '../../services/desktop';
import { DEFAULT_PAUSE_MESSAGE, describeSiteTimer, displayUrl, parseWholeNumber } from './boundaryText';
import { BoundarySectionHeader } from './BoundarySection';
import { sectionPaperSx } from './boundaryStyles';
import { FirefoxSetup } from './FirefoxSetup';

const MAX_DELAY_SECONDS = 86400;
const MAX_CLOSE_MINUTES = 1440;
const MAX_DAILY_MINUTES = 1440;

interface SiteTimersSectionProps {
    urls: SiteTimer[];
    browser: TimeoutState['browser'];
    timeouts: DesktopTimeouts;
    locked: boolean;
    onChanged: (message: string) => void;
    onError: (message: string) => void;
}

interface Draft {
    previousUrl: string | null;
    url: string;
    delay: string;
    closeAfter: string;
    daily: string;
    message: string;
}

const emptyDraft: Draft = { previousUrl: null, url: '', delay: '30', closeAfter: '5', daily: '0', message: DEFAULT_PAUSE_MESSAGE };

function draftFor(timer: SiteTimer): Draft {
    return {
        previousUrl: timer.url,
        url: displayUrl(timer.url),
        delay: String(timer.delaySeconds),
        closeAfter: String(Math.round(timer.closeAfterSeconds / 60)),
        daily: String(Math.round((timer.dailyLimitSeconds ?? 0) / 60)),
        message: timer.message,
    };
}

/** Firefox domains or URL paths that get a pause, and close Firefox once their time is up. */
export function SiteTimersSection({ urls, browser, timeouts, locked, onChanged, onError }: SiteTimersSectionProps) {
    const [draft, setDraft] = useState<Draft>(emptyDraft);
    const [running, setRunning] = useState(false);
    const busy = running || locked;
    const delaySeconds = parseWholeNumber(draft.delay, 0, MAX_DELAY_SECONDS);
    const closeAfterMinutes = parseWholeNumber(draft.closeAfter, 1, MAX_CLOSE_MINUTES);
    const dailyMinutes = parseWholeNumber(draft.daily, 0, MAX_DAILY_MINUTES);
    const valid = draft.url.trim() !== '' && delaySeconds !== null && closeAfterMinutes !== null && dailyMinutes !== null;
    const update = (patch: Partial<Draft>) => setDraft(current => ({ ...current, ...patch }));

    const run = async (action: () => Promise<unknown>, done: string, after?: () => void) => {
        setRunning(true);
        try {
            await action();
            after?.();
            onChanged(done);
        } catch (error) {
            onError(error instanceof Error ? error.message : String(error));
        } finally {
            setRunning(false);
        }
    };

    const save = () => {
        if (delaySeconds === null || closeAfterMinutes === null || dailyMinutes === null) return;
        void run(
            () => timeouts.saveUrl(draft.previousUrl, draft.url, {
                delaySeconds, closeAfterSeconds: closeAfterMinutes * 60, dailyLimitSeconds: dailyMinutes * 60, message: draft.message,
            }),
            `Saved the timer for ${draft.url.trim()}. Reload the Claritard URL Gate extension to apply it.`,
            () => setDraft(emptyDraft),
        );
    };

    return (
        <Paper elevation={0} sx={sectionPaperSx}>
            <BoundarySectionHeader
                Icon={PublicRoundedIcon}
                title="Firefox site timers"
                description="A pause before a site opens in Firefox. Once you open it, Firefox closes when the time is up, even if you close and reopen it in between. With a daily limit, the site won't open again until tomorrow once the day's time is used."
            />

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(260px, 340px) 1fr' }, gap: { xs: 2, md: 3 } }}>
                <Box sx={{ minWidth: 0 }}>
                    {browser.sessionDeadline && (
                        <Chip
                            color="primary"
                            variant="outlined"
                            label={`Firefox closes at ${new Date(browser.sessionDeadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                            sx={{ mb: 1.25 }}
                        />
                    )}
                    <List dense aria-label="Site timers" sx={{ border: 1, borderColor: 'divider', borderRadius: 2, py: 0.5, minHeight: 120 }}>
                        {urls.map(timer => (
                            <ListItem
                                key={timer.url}
                                disablePadding
                                secondaryAction={
                                    <IconButton
                                        edge="end"
                                        aria-label={`Remove the timer for ${displayUrl(timer.url)}`}
                                        disabled={busy}
                                        onClick={() => void run(
                                            () => timeouts.removeUrl(timer.url),
                                            `Removed ${displayUrl(timer.url)}. Reload the Claritard URL Gate extension to apply it.`,
                                            () => { if (draft.previousUrl === timer.url) setDraft(emptyDraft); },
                                        )}
                                    >
                                        <DeleteOutlineRoundedIcon fontSize="small" />
                                    </IconButton>
                                }
                            >
                                <ListItemButton
                                    selected={draft.previousUrl === timer.url}
                                    onClick={() => setDraft(draftFor(timer))}
                                    sx={{ borderRadius: 1.5, mx: 0.5, '&.Mui-selected': { bgcolor: 'action.selected' } }}
                                >
                                    <ListItemText
                                        primary={displayUrl(timer.url)}
                                        secondary={browser.unlockedUrls.includes(timer.url) ? 'Open in this Firefox session' : describeSiteTimer(timer)}
                                        primaryTypographyProps={{ noWrap: true, fontWeight: 600 }}
                                        secondaryTypographyProps={{ noWrap: true }}
                                    />
                                </ListItemButton>
                            </ListItem>
                        ))}
                        {!urls.length && (
                            <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>No site timers yet.</Typography>
                        )}
                    </List>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                    <Typography variant="subtitle2" fontWeight={700}>
                        {draft.previousUrl ? `Edit ${displayUrl(draft.previousUrl)}` : 'New site timer'}
                    </Typography>
                    <TextField
                        label="Domain or URL path"
                        size="small"
                        placeholder="youtube.com or youtube.com/shorts"
                        helperText="A domain covers its subdomains; a path covers its subpages."
                        value={draft.url}
                        disabled={busy}
                        onChange={event => update({ url: event.target.value })}
                    />
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                        <AppNumberField
                            label="Pause before opening"
                            size="small"
                            value={draft.delay}
                            min={0}
                            max={MAX_DELAY_SECONDS}
                            disabled={busy}
                            error={delaySeconds === null}
                            helperText="Seconds the tab must stay active"
                            onChange={event => update({ delay: event.target.value })}
                            onStepValueChange={value => update({ delay: String(value) })}
                        />
                        <AppNumberField
                            label="Close Firefox after"
                            size="small"
                            value={draft.closeAfter}
                            min={1}
                            max={MAX_CLOSE_MINUTES}
                            disabled={busy}
                            error={closeAfterMinutes === null}
                            helperText="Minutes, 1 to 1440"
                            onChange={event => update({ closeAfter: event.target.value })}
                            onStepValueChange={value => update({ closeAfter: String(value) })}
                        />
                        <AppNumberField
                            label="Daily limit"
                            size="small"
                            value={draft.daily}
                            min={0}
                            max={MAX_DAILY_MINUTES}
                            disabled={busy}
                            error={dailyMinutes === null}
                            helperText="Minutes a day the site may be open; 0 for none"
                            onChange={event => update({ daily: event.target.value })}
                            onStepValueChange={value => update({ daily: String(value) })}
                        />
                    </Box>
                    <TextField
                        label="Countdown message"
                        size="small"
                        value={draft.message}
                        disabled={busy}
                        inputProps={{ maxLength: 300 }}
                        onChange={event => update({ message: event.target.value })}
                    />
                    <Box sx={{ display: 'flex', gap: 1.25, flexWrap: 'wrap' }}>
                        <Button variant="contained" disableElevation disabled={busy || !valid} onClick={save} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, px: 2.5 }}>
                            {draft.previousUrl ? 'Save timer' : 'Add timer'}
                        </Button>
                        {draft.previousUrl && (
                            <Button color="inherit" variant="outlined" disabled={busy} onClick={() => setDraft(emptyDraft)} sx={{ borderRadius: 2, textTransform: 'none' }}>
                                New timer
                            </Button>
                        )}
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                        Every timed site opened in one Firefox session shares the first one's time limit.
                    </Typography>
                </Box>
            </Box>

            <FirefoxSetup browser={browser} timeouts={timeouts} onChanged={onChanged} onError={onError} />
        </Paper>
    );
}
