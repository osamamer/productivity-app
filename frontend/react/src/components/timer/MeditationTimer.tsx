import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    MenuItem,
    Slider,
    Skeleton,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import SelfImprovementIcon from '@mui/icons-material/SelfImprovement';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import StopIcon from '@mui/icons-material/Stop';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import { meditationService } from '../../services/api/meditationService.ts';
import { userService } from '../../services/api/userService.ts';
import { useUser } from '../../hooks/useUser';
import {
    playMeditationCompletionGong,
    playMeditationIntervalBell,
    prepareAudioFeedback,
    prepareMeditationAudio,
} from '../../services/audioFeedback.ts';
import { MeditationSession } from '../../types/MeditationSession.ts';
import {
    MEDITATION_SOUND_OPTIONS,
    MeditationSoundId,
    meditationSoundscape,
} from './meditationSounds.ts';
import { MeditationNavigationGuard } from './MeditationNavigationGuard.tsx';
import { getRuntimeUserPreferences, subscribeToUserPreferences, updateRuntimeUserPreferences } from '../../services/userPreferenceStore';

const DURATION_OPTIONS = [5, 10, 15, 20, 30];
const MIN_MOOD = 1;
const MAX_MOOD = 10;
interface MeditationSettings {
    durationMinutes: number;
    numIntervalBells: number;
    selectedSound: MeditationSoundId;
}

const DEFAULT_MEDITATION_SETTINGS: MeditationSettings = {
    durationMinutes: 10,
    numIntervalBells: 2,
    selectedSound: 'rain',
};

function isMeditationSound(value: unknown): value is MeditationSoundId {
    return typeof value === 'string' && MEDITATION_SOUND_OPTIONS.some(option => option.id === value);
}

function isValidIntervalBellCount(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 10;
}

function readMeditationSettings(): MeditationSettings {
    const preferences = getRuntimeUserPreferences();
    return {
        durationMinutes: DURATION_OPTIONS.includes(preferences.meditationDurationMinutes)
            ? preferences.meditationDurationMinutes
            : DEFAULT_MEDITATION_SETTINGS.durationMinutes,
        numIntervalBells: isValidIntervalBellCount(preferences.meditationIntervalBells)
            ? preferences.meditationIntervalBells
            : DEFAULT_MEDITATION_SETTINGS.numIntervalBells,
        selectedSound: isMeditationSound(preferences.meditationSound)
            ? preferences.meditationSound
            : DEFAULT_MEDITATION_SETTINGS.selectedSound,
    };
}

function storeMeditationSettings(userId: string | undefined, settings: MeditationSettings): void {
    updateRuntimeUserPreferences({
        meditationDurationMinutes: settings.durationMinutes,
        meditationIntervalBells: settings.numIntervalBells,
        meditationSound: settings.selectedSound,
    });
    if (!userId) return;
    void userService.updatePreferences({
        meditationDurationMinutes: settings.durationMinutes,
        meditationIntervalBells: settings.numIntervalBells,
        meditationSound: settings.selectedSound,
    }).catch(error => console.error('Could not save meditation preferences:', error));
}

function parseDate(value: string | null): number | null {
    if (!value) return null;
    const timestamp = new Date(value).getTime();
    return Number.isNaN(timestamp) ? null : timestamp;
}

function durationInSeconds(value: MeditationSession['totalSessionTime']): number {
    if (typeof value === 'number') return Math.max(0, Math.floor(value));
    if (Array.isArray(value)) return Math.max(0, Math.floor(value[0] + value[1] / 1_000_000_000));
    if (typeof value !== 'string') return 0;

    const isoDuration = value.match(/^PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/i);
    if (!isoDuration) return 0;
    return Math.max(
        0,
        Math.floor(
            Number(isoDuration[1] || 0) * 3600 +
            Number(isoDuration[2] || 0) * 60 +
            Number(isoDuration[3] || 0),
        ),
    );
}

interface ClientRunningAnchor {
    sessionId: string;
    startedAt: number;
}

function elapsedSeconds(
    session: MeditationSession,
    now = Date.now(),
    clientRunningAnchor: ClientRunningAnchor | null = null,
): number {
    const persistedSeconds = durationInSeconds(session.totalSessionTime);
    if (!session.running) return persistedSeconds;
    if (clientRunningAnchor?.sessionId === session.id) {
        return persistedSeconds + Math.max(0, Math.floor((now - clientRunningAnchor.startedAt) / 1000));
    }

    const lastUnpause = parseDate(session.lastUnpauseTime);
    if (lastUnpause === null) return persistedSeconds;
    return persistedSeconds + Math.max(0, Math.floor((now - lastUnpause) / 1000));
}

function createOptimisticSession(
    startedAt: number,
    moodBefore: number,
    numIntervalBells: number,
    intendedLength: number,
): MeditationSession {
    const timestamp = new Date(startedAt).toISOString();
    return {
        id: `optimistic-meditation-${startedAt}-${Math.random().toString(36).slice(2)}`,
        running: true,
        active: true,
        totalSessionTime: 0,
        startTime: timestamp,
        lastUnpauseTime: timestamp,
        lastPauseTime: null,
        endTime: null,
        moodBefore,
        moodAfter: 0,
        numIntervalBells,
        intendedLength,
    };
}

function formatTime(totalSeconds: number): string {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function moodLabel(mood: number): string {
    if (mood <= 2) return 'Very low';
    if (mood <= 4) return 'Low';
    if (mood <= 6) return 'Okay';
    if (mood <= 8) return 'Good';
    return 'Very good';
}

interface MeditationTimerProps {
    onSessionCompleted: () => void;
}

export function MeditationTimer({ onSessionCompleted }: MeditationTimerProps) {
    const { user } = useUser();
    const settingsStorageKey = user?.id ?? 'anonymous';
    const [session, setSession] = useState<MeditationSession | null>(null);
    const [elapsed, setElapsed] = useState(0);
    const [moodBefore, setMoodBefore] = useState(5);
    const [moodAfter, setMoodAfter] = useState(5);
    const [durationMinutes, setDurationMinutes] = useState(DEFAULT_MEDITATION_SETTINGS.durationMinutes);
    const [numIntervalBells, setNumIntervalBells] = useState(DEFAULT_MEDITATION_SETTINGS.numIntervalBells);
    const [selectedSound, setSelectedSound] = useState<MeditationSoundId>(DEFAULT_MEDITATION_SETTINGS.selectedSound);
    const [soundMuted, setSoundMuted] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [startPending, setStartPending] = useState(false);
    const [finishDialogOpen, setFinishDialogOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [completedSession, setCompletedSession] = useState<MeditationSession | null>(null);
    const bellSessionRef = useRef<string | null>(null);
    const lastBellRef = useRef(0);
    const completionGongSessionRef = useRef<string | null>(null);
    const soundStartedByUserRef = useRef(false);
    const mountedRef = useRef(true);
    const [clientRunningAnchor, setClientRunningAnchor] = useState<ClientRunningAnchor | null>(null);
    const [loadedSettingsKey, setLoadedSettingsKey] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        void userService.getPreferences().then(() => {
            if (cancelled) return;
            const stored = readMeditationSettings();
            setDurationMinutes(stored.durationMinutes);
            setNumIntervalBells(stored.numIntervalBells);
            setSelectedSound(stored.selectedSound);
            setLoadedSettingsKey(settingsStorageKey);
        }).catch(error => console.error('Could not load meditation preferences:', error));
        return () => { cancelled = true; };
    }, [settingsStorageKey, user?.id]);

    useEffect(() => subscribeToUserPreferences(() => {
        const stored = readMeditationSettings();
        setDurationMinutes(stored.durationMinutes);
        setNumIntervalBells(stored.numIntervalBells);
        setSelectedSound(stored.selectedSound);
    }), [user?.id]);

    useEffect(() => {
        if (loadedSettingsKey !== settingsStorageKey) return;
        storeMeditationSettings(user?.id, { durationMinutes, numIntervalBells, selectedSound });
    }, [durationMinutes, loadedSettingsKey, numIntervalBells, selectedSound, settingsStorageKey, user?.id]);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            meditationSoundscape.stop();
        };
    }, []);

    useEffect(() => {
        meditationSoundscape.prepare(selectedSound);
    }, [selectedSound]);

    useEffect(() => {
        let mounted = true;
        meditationService.getActiveSession()
            .then(activeSession => {
                if (mounted) {
                    setSession(activeSession);
                    if (activeSession) setElapsed(elapsedSeconds(activeSession));
                }
            })
            .catch(() => {
                if (mounted) setError('Could not restore your meditation session.');
            })
            .finally(() => {
                if (mounted) setIsLoading(false);
            });

        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        if (!session) {
            setElapsed(0);
            return;
        }

        const updateElapsed = () => setElapsed(elapsedSeconds(session, Date.now(), clientRunningAnchor));
        updateElapsed();
        if (!session.running) return;

        const interval = window.setInterval(updateElapsed, 1000);
        return () => window.clearInterval(interval);
    }, [clientRunningAnchor, session]);

    useEffect(() => {
        if (!session || !session.intendedLength || !session.numIntervalBells) {
            bellSessionRef.current = null;
            lastBellRef.current = 0;
            return;
        }

        const secondsPerBell = session.intendedLength / (session.numIntervalBells + 1);
        const currentBell = Math.min(session.numIntervalBells, Math.floor(elapsed / secondsPerBell));
        if (bellSessionRef.current !== session.id) {
            bellSessionRef.current = session.id;
            lastBellRef.current = currentBell;
            return;
        }

        if (!session.running || currentBell <= lastBellRef.current) return;
        lastBellRef.current = currentBell;
        if (soundMuted) return;
        playMeditationIntervalBell();
    }, [elapsed, session, soundMuted]);

    useEffect(() => {
        if (!session) {
            soundStartedByUserRef.current = false;
            return;
        }
        if (!soundMuted && !soundStartedByUserRef.current) {
            void meditationSoundscape.start(selectedSound);
        }
    }, [selectedSound, session, soundMuted]);

    const remaining = session?.intendedLength
        ? Math.max(0, session.intendedLength - elapsed)
        : null;
    const progress = session?.intendedLength
        ? Math.min(100, (elapsed / session.intendedLength) * 100)
        : 0;
    const sessionComplete = remaining === 0 && (session?.intendedLength ?? 0) > 0;

    useEffect(() => {
        if (!session) {
            completionGongSessionRef.current = null;
            return;
        }
        if (!sessionComplete || completionGongSessionRef.current === session.id) return;

        completionGongSessionRef.current = session.id;
        meditationSoundscape.stop();
        playMeditationCompletionGong();
    }, [session, sessionComplete]);

    const bellDescription = useMemo(() => {
        if (numIntervalBells === 0) return 'No interval bells';
        return `${numIntervalBells} gentle bell${numIntervalBells === 1 ? '' : 's'} during the session`;
    }, [numIntervalBells]);

    const handleSoundChange = (sound: MeditationSoundId) => {
        setSelectedSound(sound);
        if (session) {
            if (soundMuted) setSoundMuted(false);
            soundStartedByUserRef.current = true;
            void meditationSoundscape.start(sound);
        } else if (!session) {
            void meditationSoundscape.preview(sound);
        }
    };

    const toggleSound = () => {
        if (soundMuted) {
            setSoundMuted(false);
            soundStartedByUserRef.current = true;
            void meditationSoundscape.start(selectedSound);
        } else {
            setSoundMuted(true);
            meditationSoundscape.stop();
        }
    };

    const startSession = async () => {
        if (session || startPending) return;

        const startedAt = Date.now();
        const intendedLength = durationMinutes * 60;
        const optimisticSession = createOptimisticSession(
            startedAt,
            moodBefore,
            numIntervalBells,
            intendedLength,
        );
        const optimisticAnchor = { sessionId: optimisticSession.id, startedAt };

        setStartPending(true);
        setActionLoading(true);
        setError(null);
        setCompletedSession(null);
        setSession(optimisticSession);
        setClientRunningAnchor(optimisticAnchor);
        setElapsed(0);
        if (!soundMuted) {
            soundStartedByUserRef.current = true;
            void meditationSoundscape.start(selectedSound);
        }
        prepareAudioFeedback();
        prepareMeditationAudio();
        try {
            const started = await meditationService.startSession({
                mood: moodBefore,
                numIntervalBells,
                intendedLength,
            });
            if (!mountedRef.current) {
                meditationService.endSessionOnUnload(started.id);
                return;
            }

            setSession(started);
            const reconciledAnchor = { sessionId: started.id, startedAt };
            setClientRunningAnchor(reconciledAnchor);
            setElapsed(elapsedSeconds(started, Date.now(), reconciledAnchor));
        } catch (startError) {
            if (!mountedRef.current) return;
            setSession(null);
            setClientRunningAnchor(null);
            setElapsed(0);
            meditationSoundscape.stop();
            soundStartedByUserRef.current = false;
            setError(startError instanceof Error ? startError.message : 'Could not start meditation.');
        } finally {
            if (mountedRef.current) {
                setStartPending(false);
                setActionLoading(false);
            }
        }
    };

    const togglePause = async () => {
        if (!session) return;
        setActionLoading(true);
        setError(null);
        try {
            const updated = session.running
                ? await meditationService.pauseSession(session.id)
                : await meditationService.unpauseSession(session.id);
            setSession(updated);
            const updatedAt = Date.now();
            const nextAnchor = updated.running ? { sessionId: updated.id, startedAt: updatedAt } : null;
            setClientRunningAnchor(nextAnchor);
            setElapsed(elapsedSeconds(updated, updatedAt, nextAnchor));
            if (updated.running) {
                if (!soundMuted) await meditationSoundscape.resume();
            } else {
                meditationSoundscape.pause();
            }
        } catch (pauseError) {
            setError(pauseError instanceof Error ? pauseError.message : 'Could not update meditation.');
        } finally {
            setActionLoading(false);
        }
    };

    const finishSession = async () => {
        if (!session) return;
        setActionLoading(true);
        setError(null);
        try {
            const finished = await meditationService.endSession(session.id, moodAfter);
            setCompletedSession(finished);
            setSession(null);
            setClientRunningAnchor(null);
            meditationSoundscape.stop();
            soundStartedByUserRef.current = false;
            setFinishDialogOpen(false);
            onSessionCompleted();
        } catch (finishError) {
            setError(finishError instanceof Error ? finishError.message : 'Could not finish meditation.');
        } finally {
            setActionLoading(false);
        }
    };

    const discardSession = async () => {
        if (!session) return;
        setActionLoading(true);
        setError(null);
        try {
            await meditationService.discardSession(session.id);
            setSession(null);
            setClientRunningAnchor(null);
            meditationSoundscape.stop();
            soundStartedByUserRef.current = false;
            setFinishDialogOpen(false);
        } catch (discardError) {
            setError(discardError instanceof Error ? discardError.message : 'Could not dismiss meditation.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleDurationChange = (event: ChangeEvent<HTMLInputElement>) => {
        setDurationMinutes(Number(event.target.value));
    };

    if (isLoading) {
        return (
            <Box sx={{ width: '100%', p: { xs: 2, sm: 3, lg: 4 }, minHeight: { xs: 610, sm: 620, md: 620 }, boxSizing: 'border-box' }}>
                <Stack spacing={3}>
                    <Box>
                        <Skeleton variant="text" width="35%" height={48} />
                        <Skeleton variant="text" width="62%" />
                    </Box>
                    <Box>
                        <Skeleton variant="text" width="48%" />
                        <Skeleton variant="rounded" height={8} sx={{ mt: 1.5 }} />
                        <Skeleton variant="text" width="92%" />
                    </Box>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                        <Skeleton variant="rounded" height={56} sx={{ flex: 1 }} />
                        <Skeleton variant="rounded" height={72} sx={{ flex: 1 }} />
                    </Stack>
                    <Box>
                        <Skeleton variant="text" width="42%" />
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                            <Skeleton variant="rounded" height={62} sx={{ flex: 1 }} />
                            <Skeleton variant="rounded" height={62} sx={{ flex: 1 }} />
                        </Stack>
                    </Box>
                    <Skeleton variant="rounded" width={170} height={44} />
                </Stack>
            </Box>
        );
    }

    return (
        <Box sx={{ width: '100%', p: { xs: 2, sm: 3, lg: 4 }, minHeight: { xs: 610, sm: 620, md: 620 }, boxSizing: 'border-box' }}>
            <Stack spacing={3}>
                <Box sx={{ textAlign: 'left' }}>
                    <Typography variant="h4" sx={{ fontWeight: 400, mb: 1 }}>
                        Meditation
                    </Typography>
                    <Typography color="text.secondary">
                        A quiet pause to return to yourself.
                    </Typography>
                </Box>

                {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

                {session ? (
                    <ActiveMeditation
                        session={session}
                        elapsed={elapsed}
                        remaining={remaining}
                        progress={progress}
                        sessionComplete={sessionComplete}
                        actionLoading={actionLoading}
                        selectedSound={selectedSound}
                        soundMuted={soundMuted}
                        onTogglePause={togglePause}
                        onSoundChange={handleSoundChange}
                        onToggleSound={toggleSound}
                        onFinish={() => setFinishDialogOpen(true)}
                    />
                ) : (
                    <StartMeditation
                        mood={moodBefore}
                        durationMinutes={durationMinutes}
                        numIntervalBells={numIntervalBells}
                        bellDescription={bellDescription}
                        selectedSound={selectedSound}
                        actionLoading={actionLoading}
                        completedSession={completedSession}
                        onDismissCompleted={() => setCompletedSession(null)}
                        onMoodChange={setMoodBefore}
                        onDurationChange={handleDurationChange}
                        onBellsChange={(_, value) => setNumIntervalBells(value as number)}
                        onSoundChange={handleSoundChange}
                        onStart={startSession}
                    />
                )}
            </Stack>

            <Dialog open={finishDialogOpen} onClose={() => !actionLoading && setFinishDialogOpen(false)} fullWidth maxWidth="xs">
                <DialogTitle>How do you feel now?</DialogTitle>
                <DialogContent>
                    <Typography color="text.secondary" sx={{ mb: 3 }}>
                        Save a quick check-in with this meditation session.
                    </Typography>
                    <Slider
                        value={moodAfter}
                        min={MIN_MOOD}
                        max={MAX_MOOD}
                        marks
                        valueLabelDisplay="auto"
                        onChange={(_, value) => setMoodAfter(value as number)}
                    />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                        <Typography variant="body2" color="text.secondary">1 · Very low</Typography>
                        <Typography variant="body2" color="text.secondary">{moodAfter} · {moodLabel(moodAfter)}</Typography>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button color="error" onClick={discardSession} disabled={actionLoading}>Dismiss session</Button>
                    <Button onClick={() => setFinishDialogOpen(false)} disabled={actionLoading}>Keep sitting</Button>
                    <Button variant="contained" onClick={finishSession} disabled={actionLoading}>
                        {actionLoading ? <CircularProgress size={18} color="inherit" /> : 'Save session'}
                    </Button>
                </DialogActions>
            </Dialog>

            <MeditationNavigationGuard
                session={startPending ? null : session}
                onSessionEnded={() => {
                    setSession(null);
                    setClientRunningAnchor(null);
                    meditationSoundscape.stop();
                    soundStartedByUserRef.current = false;
                    onSessionCompleted();
                }}
                onError={message => setError(message || null)}
            />
        </Box>
    );
}

interface StartMeditationProps {
    mood: number;
    durationMinutes: number;
    numIntervalBells: number;
    bellDescription: string;
    selectedSound: MeditationSoundId;
    actionLoading: boolean;
    completedSession: MeditationSession | null;
    onDismissCompleted: () => void;
    onMoodChange: (value: number) => void;
    onDurationChange: (event: ChangeEvent<HTMLInputElement>) => void;
    onBellsChange: (_event: Event, value: number | number[]) => void;
    onSoundChange: (sound: MeditationSoundId) => void;
    onStart: () => void;
}

function StartMeditation({
    mood,
    durationMinutes,
    numIntervalBells,
    bellDescription,
    selectedSound,
    actionLoading,
    completedSession,
    onDismissCompleted,
    onMoodChange,
    onDurationChange,
    onBellsChange,
    onSoundChange,
    onStart,
}: StartMeditationProps) {
    return (
        <Stack spacing={2.5}>
            {completedSession && (
                <Alert severity="success" onClose={onDismissCompleted}>
                    Meditation saved — you spent {formatTime(durationInSeconds(completedSession.totalSessionTime))} in stillness.
                </Alert>
            )}

            <Box sx={{ py: { xs: 1, md: 2 }, textAlign: 'left' }}>
                <Stack spacing={3}>
                    <Box>
                        <Typography variant="h6" sx={{ mb: 0.5 }}>Settle in</Typography>
                        <Typography variant="body2" color="text.secondary">
                            Choose a length and check in with your mood before you begin.
                        </Typography>
                    </Box>

                    <Box>
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>
                            How are you feeling? <Box component="span" color="text.secondary">{mood} · {moodLabel(mood)}</Box>
                        </Typography>
                        <Slider
                            value={mood}
                            min={MIN_MOOD}
                            max={MAX_MOOD}
                            marks
                            valueLabelDisplay="auto"
                            onChange={(_, value) => onMoodChange(value as number)}
                        />
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="caption" color="text.secondary">Very low</Typography>
                            <Typography variant="caption" color="text.secondary">Very good</Typography>
                        </Box>
                    </Box>

                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                        <TextField select label="Session length" value={durationMinutes} autoComplete="off" onChange={onDurationChange}>
                            {DURATION_OPTIONS.map(option => <MenuItem key={option} value={option}>{option} minutes</MenuItem>)}
                        </TextField>
                        <Box sx={{ px: 1 }}>
                            <Typography variant="subtitle2">Interval bells: {numIntervalBells}</Typography>
                            <Slider
                                value={numIntervalBells}
                                min={0}
                                max={10}
                                marks
                                valueLabelDisplay="auto"
                                onChange={onBellsChange}
                            />
                            <Typography variant="caption" color="text.secondary">{bellDescription}</Typography>
                        </Box>
                    </Box>

                    <Box>
                        <Typography variant="subtitle2" sx={{ mb: 1.25 }}>Choose a soundscape</Typography>
                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 1 }}>
                            {MEDITATION_SOUND_OPTIONS.map(option => {
                                const selected = selectedSound === option.id;
                                return (
                                    <Button
                                        key={option.id}
                                        variant={selected ? 'contained' : 'outlined'}
                                        color={selected ? 'primary' : 'inherit'}
                                        data-meditation-sound-preview="true"
                                        onClick={() => onSoundChange(option.id)}
                                        startIcon={<MusicNoteIcon />}
                                        sx={{
                                            justifyContent: 'flex-start',
                                            alignItems: 'flex-start',
                                            textAlign: 'left',
                                            borderRadius: 2,
                                            minHeight: 62,
                                            px: 1.5,
                                            py: 1,
                                            textTransform: 'none',
                                        }}
                                    >
                                        <Box>
                                            <Typography variant="body2" sx={{ fontWeight: 600 }}>{option.label}</Typography>
                                            <Typography variant="caption" sx={{ opacity: selected ? 0.85 : 0.7 }}>{option.description}</Typography>
                                        </Box>
                                    </Button>
                                );
                            })}
                        </Box>
                    </Box>

                    <Button
                        variant="contained"
                        size="large"
                        onClick={onStart}
                        disabled={actionLoading}
                        startIcon={actionLoading ? <CircularProgress size={19} color="inherit" /> : <PlayArrowIcon />}
                        sx={{ alignSelf: 'flex-start', borderRadius: 2, px: 3, textTransform: 'none' }}
                    >
                        {actionLoading ? 'Starting…' : 'Begin meditation'}
                    </Button>
                </Stack>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary', px: 1 }}>
                <SelfImprovementIcon fontSize="small" />
                <Typography variant="body2">You can pause or finish your session whenever you need.</Typography>
            </Box>
        </Stack>
    );
}

interface ActiveMeditationProps {
    session: MeditationSession;
    elapsed: number;
    remaining: number | null;
    progress: number;
    sessionComplete: boolean;
    actionLoading: boolean;
    selectedSound: MeditationSoundId;
    soundMuted: boolean;
    onTogglePause: () => void;
    onSoundChange: (sound: MeditationSoundId) => void;
    onToggleSound: () => void;
    onFinish: () => void;
}

function ActiveMeditation({
    session,
    elapsed,
    remaining,
    progress,
    sessionComplete,
    actionLoading,
    selectedSound,
    soundMuted,
    onTogglePause,
    onSoundChange,
    onToggleSound,
    onFinish,
}: ActiveMeditationProps) {
    return (
        <Box sx={{ py: { xs: 1, md: 2 } }}>
            <Stack spacing={3} alignItems="center">
                <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                    <CircularProgress
                        variant="determinate"
                        value={100}
                        size={250}
                        thickness={1.5}
                        sx={{ color: 'action.hover' }}
                    />
                    <CircularProgress
                        variant="determinate"
                        value={progress}
                        size={250}
                        thickness={1.5}
                        sx={{ color: 'primary.main', position: 'absolute', left: 0 }}
                    />
                    <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <SelfImprovementIcon sx={{ fontSize: 34, color: 'primary.main', mb: 1 }} />
                        <Typography variant="h2" sx={{ fontWeight: 300, fontVariantNumeric: 'tabular-nums' }}>
                            {remaining === null ? formatTime(elapsed) : formatTime(remaining)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {remaining === null ? 'elapsed' : sessionComplete ? 'time is up' : session.running ? 'remaining' : 'paused'}
                        </Typography>
                    </Box>
                </Box>

                <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h5" sx={{ mb: 0.75, fontWeight: 400 }}>
                        {sessionComplete ? 'Beautifully done.' : session.running ? 'Be here.' : 'Paused.'}
                    </Typography>
                    <Typography color="text.secondary">
                        {sessionComplete
                            ? 'Take a moment before you close the session.'
                            : `${session.numIntervalBells} interval bell${session.numIntervalBells === 1 ? '' : 's'} · ${session.intendedLength ? `${Math.round(session.intendedLength / 60)} minutes` : 'open-ended session'}`}
                    </Typography>
                </Box>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="center">
                    <TextField
                        select
                        autoComplete="off"
                        size="small"
                        label="Soundscape"
                        value={selectedSound}
                        onChange={event => onSoundChange(event.target.value as MeditationSoundId)}
                        sx={{ minWidth: 190 }}
                    >
                        {MEDITATION_SOUND_OPTIONS.map(option => (
                            <MenuItem key={option.id} value={option.id}>{option.label}</MenuItem>
                        ))}
                    </TextField>
                    <Button
                        variant="outlined"
                        onClick={onToggleSound}
                        startIcon={soundMuted ? <VolumeOffIcon /> : <VolumeUpIcon />}
                        sx={{ borderRadius: 2, minWidth: 130, textTransform: 'none' }}
                    >
                        {soundMuted ? 'Sound off' : 'Mute sound'}
                    </Button>
                </Stack>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                    {!sessionComplete && (
                        <Button
                            variant="outlined"
                            onClick={onTogglePause}
                            disabled={actionLoading}
                            startIcon={session.running ? <PauseIcon /> : <PlayArrowIcon />}
                            sx={{ borderRadius: 2, minWidth: 140, textTransform: 'none' }}
                        >
                            {session.running ? 'Pause' : 'Resume'}
                        </Button>
                    )}
                    <Button
                        variant={sessionComplete ? 'contained' : 'text'}
                        color={sessionComplete ? 'primary' : 'inherit'}
                        onClick={onFinish}
                        disabled={actionLoading}
                        startIcon={<StopIcon />}
                        sx={{ borderRadius: 2, minWidth: 140, textTransform: 'none' }}
                    >
                        {sessionComplete ? 'Finish session' : 'End early'}
                    </Button>
                </Stack>
            </Stack>
        </Box>
    );
}

export default MeditationTimer;
