import { useCallback, useEffect, useId, useRef, useState, type MouseEvent } from 'react';
import {
    Divider,
    IconButton,
    ListItemIcon,
    ListItemText,
    Menu,
    MenuItem,
    Tooltip,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import { usePomodoro } from '../../hooks/usePomodoro';
import {
    getAvailableWhiteNoiseSounds,
    getWhiteNoiseSource,
    selectWhiteNoiseSound,
    subscribeToWhiteNoiseSource,
    type WhiteNoiseSource,
} from '../../services/whiteNoise';
import {
    BUILT_IN_POMODORO_SOUND,
    getCachedPomodoroSounds,
    preloadPomodoroSoundAudio,
    type PomodoroSound,
} from '../../services/api/pomodoroSoundService';

interface WhiteNoiseControlProps {
    disabled?: boolean;
    size?: 'small' | 'medium' | 'large';
}

export function WhiteNoiseControl({ disabled = false, size = 'medium' }: WhiteNoiseControlProps) {
    const { whiteNoiseEnabled, setWhiteNoiseEnabled } = usePomodoro();
    const [source, setSource] = useState<WhiteNoiseSource>(getWhiteNoiseSource);
    const [sounds, setSounds] = useState<PomodoroSound[]>(() => {
        const cached = getCachedPomodoroSounds();
        return cached ? [BUILT_IN_POMODORO_SOUND, ...cached] : [];
    });
    const [soundsLoading, setSoundsLoading] = useState(false);
    const [soundLoadError, setSoundLoadError] = useState<string | null>(null);
    const [soundSelectionError, setSoundSelectionError] = useState<string | null>(null);
    const [pendingSoundId, setPendingSoundId] = useState<string | null>(null);
    const selectionAttempt = useRef(0);
    const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
    const menuId = useId();

    useEffect(() => subscribeToWhiteNoiseSource(nextSource => {
        setSource(nextSource);
        setPendingSoundId(current => current === nextSource.id ? null : current);
    }), []);

    const loadSounds = useCallback(async () => {
        const cached = getCachedPomodoroSounds();
        if (cached) {
            setSounds([BUILT_IN_POMODORO_SOUND, ...cached]);
            setSoundsLoading(false);
        } else {
            setSoundsLoading(true);
        }
        setSoundLoadError(null);
        try {
            setSounds(await getAvailableWhiteNoiseSounds());
        } catch (error) {
            console.error('Could not load focus sounds:', error);
            setSoundLoadError('Could not load focus sounds right now.');
        } finally {
            setSoundsLoading(false);
        }
    }, []);

    const handleMenuOpen = (event: MouseEvent<HTMLElement>) => {
        setMenuAnchor(event.currentTarget);
        setSoundSelectionError(null);
        void loadSounds();
    };

    const handleMenuClose = () => {
        setMenuAnchor(null);
    };

    const handleToggle = () => {
        setWhiteNoiseEnabled(!whiteNoiseEnabled);
        setMenuAnchor(null);
    };

    const handleSoundSelect = (sound: PomodoroSound) => {
        if (sound.id === source.id && pendingSoundId === null) {
            if (!whiteNoiseEnabled) setWhiteNoiseEnabled(true);
            setMenuAnchor(null);
            return;
        }

        const attempt = ++selectionAttempt.current;
        setSoundSelectionError(null);
        setPendingSoundId(sound.id);
        setMenuAnchor(null);
        if (!whiteNoiseEnabled) setWhiteNoiseEnabled(true);
        void selectWhiteNoiseSound(sound)
            .then(() => {
                if (attempt === selectionAttempt.current) setPendingSoundId(null);
            })
            .catch(error => {
                if (attempt !== selectionAttempt.current) return;
                console.error('Could not select focus sound:', error);
                setPendingSoundId(null);
                setSoundSelectionError('Could not change the focus sound right now.');
            });
    };

    const pendingSound = pendingSoundId ? sounds.find(sound => sound.id === pendingSoundId) : undefined;
    const sourceLabel = pendingSound?.name || source.name || 'Focus sound';
    const busy = disabled;

    return (
        <>
            <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                <Tooltip title={soundSelectionError ?? `Focus sound options: ${sourceLabel}`}>
                    <span>
                        <IconButton
                            onClick={handleMenuOpen}
                            aria-label="Open focus sound options"
                            aria-controls={menuAnchor ? menuId : undefined}
                            aria-haspopup="menu"
                            aria-busy={pendingSoundId !== null}
                            color={whiteNoiseEnabled ? 'primary' : 'inherit'}
                            size={size}
                            disabled={busy}
                        >
                            {whiteNoiseEnabled ? <VolumeUpIcon /> : <VolumeOffIcon />}
                        </IconButton>
                    </span>
                </Tooltip>
            </span>
            <Menu
                id={menuId}
                anchorEl={menuAnchor}
                open={Boolean(menuAnchor)}
                onClose={handleMenuClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                MenuListProps={{
                    dense: true,
                    sx: {
                        py: 0.5,
                        '& .MuiMenuItem-root': {
                            minHeight: 34,
                            px: 1,
                            py: 0.5,
                            borderRadius: 1.25,
                            '& .MuiListItemIcon-root': {
                                minWidth: 24,
                                flexShrink: 0,
                                mr: 0.5,
                            },
                            '& .MuiListItemText-root': {
                                overflow: 'hidden',
                                minWidth: 0,
                                my: 0,
                                '& .MuiListItemText-primary': {
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                },
                            },
                        },
                        '& .MuiDivider-root': { my: 0.5 },
                    },
                }}
                PaperProps={{
                    sx: {
                        width: 160,
                        minWidth: 0,
                        maxWidth: 'calc(100vw - 32px)',
                        maxHeight: 'min(320px, calc(100vh - 32px))',
                        overflowY: 'auto',
                        p: 0.5,
                    },
                }}
            >
                <MenuItem onClick={handleToggle} disabled={busy}>
                    <ListItemIcon>
                        {whiteNoiseEnabled
                            ? <VolumeOffIcon fontSize="small" />
                            : <VolumeUpIcon fontSize="small" />}
                    </ListItemIcon>
                    <ListItemText primary={whiteNoiseEnabled ? 'Mute' : 'Play'} />
                </MenuItem>
                <Divider />
                {soundsLoading && (
                    <MenuItem disabled>
                        <ListItemText primary="Loading sounds..." />
                    </MenuItem>
                )}
                {!soundsLoading && soundLoadError && (
                    <MenuItem disabled>
                        <ListItemText primary={soundLoadError} />
                    </MenuItem>
                )}
                {!soundsLoading && sounds.map(sound => (
                    <MenuItem
                        key={sound.id}
                        selected={sound.id === (pendingSoundId ?? source.id)}
                        onClick={() => handleSoundSelect(sound)}
                        onMouseEnter={() => {
                            void preloadPomodoroSoundAudio(sound).catch(error => {
                                console.warn('Could not preload focus sound:', error);
                            });
                        }}
                        onFocus={() => {
                            void preloadPomodoroSoundAudio(sound).catch(error => {
                                console.warn('Could not preload focus sound:', error);
                            });
                        }}
                        disabled={busy}
                    >
                        <ListItemIcon>
                            {sound.id === (pendingSoundId ?? source.id)
                                ? <CheckIcon fontSize="small" />
                                : <MusicNoteIcon fontSize="small" />}
                        </ListItemIcon>
                        <ListItemText primary={sound.name} />
                    </MenuItem>
                ))}
                {soundSelectionError && (
                    <MenuItem disabled>
                        <ListItemText primary={soundSelectionError} />
                    </MenuItem>
                )}
            </Menu>
        </>
    );
}
