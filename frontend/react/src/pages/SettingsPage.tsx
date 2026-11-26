import { CompactPopover } from '../components/CompactPopover';
import {
    ChangeEvent,
    FormEvent,
    SyntheticEvent,
    useEffect,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore,
} from 'react';
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    IconButton,
    LinearProgress,
    MenuItem,
    Stack,
    Switch,
    Tab,
    Tabs,
    TextField,
    Typography,
} from '@mui/material';
import LightModeIcon from '@mui/icons-material/LightMode';
import NightlightIcon from '@mui/icons-material/Nightlight';
import LogoutIcon from '@mui/icons-material/Logout';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined';
import SecurityOutlinedIcon from '@mui/icons-material/SecurityOutlined';
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined';
import CheckIcon from '@mui/icons-material/Check';
import PsychologyOutlinedIcon from '@mui/icons-material/PsychologyOutlined';
import VolumeUpOutlinedIcon from '@mui/icons-material/VolumeUpOutlined';
import MusicNoteOutlinedIcon from '@mui/icons-material/MusicNoteOutlined';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { PageWrapper } from '../components/PageWrapper.tsx';
import { useUser } from '../hooks/useUser';
import { accentColorOptions } from '../contexts/themeOptions';
import { useAppTheme } from '../hooks/useAppTheme';
import { useSearchParams } from 'react-router-dom';
import { userService } from '../services/api/userService.ts';
import { getRuntimeUserPreference, updateRuntimeUserPreferences } from '../services/userPreferenceStore';
import axios from 'axios';
import {
    getExcludeTodayCompletedHomeTasks,
    getShowCompletedHomeTasks,
    setExcludeTodayCompletedTasks,
    setShowCompletedHomeTasks,
} from '../services/utils/homePreferences.ts';
import {
    createPomodoroFormDefaults,
    DEFAULT_LONG_BREAK_COOLDOWN,
    getPomodoroConfig,
    NORMAL_POMODORO_CONFIG,
    PomodoroConfig,
    readPomodoroFormPreferences,
    savePomodoroFormPreferences,
    setPomodoroSecondsModePreference,
    subscribeToPomodoroFormPreferences,
} from '../services/api/pomodoroConfigService.ts';
import {
    getShowClosedMentalThreads,
    setShowClosedMentalThreads,
} from '../services/utils/mentalThreadPreferences.ts';
import { isAudioFeedbackEnabled, setAudioFeedbackEnabled } from '../services/audioFeedback.ts';
import {
    BUILT_IN_POMODORO_SOUND,
    BUILT_IN_POMODORO_SOUND_ID,
    deletePomodoroSound,
    getCachedPomodoroSounds,
    getPomodoroSoundAudioUrl,
    getPomodoroSounds,
    MAX_POMODORO_SOUND_SIZE_BYTES,
    preloadPomodoroSoundAudio,
    PomodoroSound,
} from '../services/api/pomodoroSoundService.ts';
import {
    cancelPomodoroSoundUpload,
    clearPomodoroSoundUploadResult,
    getPomodoroSoundUploadSnapshot,
    getPomodoroSoundUploadErrorMessage,
    isPomodoroSoundUploadActive,
    isPomodoroSoundUploadCancellation,
    startPomodoroSoundUpload,
    subscribeToPomodoroSoundUpload,
} from '../services/pomodoroSoundUpload.ts';
import { selectWhiteNoiseSound, setWhiteNoiseSource } from '../services/whiteNoise.ts';
import { isDesktopApp, isLocalDesktopMode } from '../services/desktop';
import LocalBackupSection from '../components/settings/LocalBackupSection';
import AppVersionInfo from '../components/settings/AppVersionInfo';
import DesktopStorageSection from '../components/settings/DesktopStorageSection';
import ScreenTimeSection from '../components/settings/ScreenTimeSection';
import { ActivitiesSection } from '../components/settings/ActivitiesSection';
import { sectionCardSx, sectionHeadingSx } from '../components/settings/settingsStyles';
import { CheckupSettingsSection } from '../components/settings/CheckupSettingsSection';
import { BrowserNotificationsSection } from '../components/settings/BrowserNotificationsSection';

const hideCompletedTasksDescription = 'Hide completed tasks on the Tasks page. Calendar uses its own status filter.';
const excludeTodayCompletedTasksDescription = 'Also hide completed tasks scheduled for today from the Home page.';
const pomodoroAutoStartDescription = 'Start each break and focus session automatically, or wait for you to start the next phase.';
const pomodoroSecondsModeDescription = 'Use 10-second focus and break durations instead of the normal 25/5/15-minute defaults.';
const pomodoroLongBreakDescription = 'Take a long break after this many completed focus sessions in every Pomodoro.';
const pomodoroTimeAdjustmentDescription = 'Minutes added or removed each time you adjust the timer.';
const pomodoroSoundDescription = 'Use brown noise or one of your uploaded MP3 files during focus sessions.';
const showClosedMentalThreadsDescription = 'Keep closed threads visible in the mental threads list.';
const soundEffectsDescription = 'Play short musical cues when you complete, capture, schedule, or rate something.';
const muteFocusNoiseDuringBreaksDescription = 'Mute focus noise when a running focus session pauses or ends.';
export function SettingsPage() {
    const { user, logout } = useUser();
    const { accentColor, darkMode, setAccentColor, setTheme } = useAppTheme();
    const [searchParams, setSearchParams] = useSearchParams();
    const initialTab = useMemo(() => {
        const tab = searchParams.get('tab');
        if (tab === 'appearance') return 1;
        if (tab === 'account') return 2;
        return 0;
    }, [searchParams]);
    const [activeTab, setActiveTab] = useState(initialTab);
    const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
    const [logoutAnchorPosition, setLogoutAnchorPosition] = useState<{ top: number; left: number } | null>(null);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
    const [passwordSaving, setPasswordSaving] = useState(false);
    const [changePasswordOpen, setChangePasswordOpen] = useState(false);
    const [hideCompletedTasks, setHideCompletedTasks] = useState(() => !getShowCompletedHomeTasks());
    const [excludeTodayCompletedTasks, setExcludeTodayCompletedTasksState] = useState(getExcludeTodayCompletedHomeTasks);
    const [homeDayEndHour, setHomeDayEndHour] = useState(0);
    const [homeDayEndHourSaving, setHomeDayEndHourSaving] = useState(false);
    const [showClosedMentalThreads, setShowClosedMentalThreadsState] = useState(getShowClosedMentalThreads);
    const [soundEffectsEnabled, setSoundEffectsEnabledState] = useState(isAudioFeedbackEnabled);
    const [muteFocusNoiseDuringBreaks, setMuteFocusNoiseDuringBreaks] = useState(
        () => getRuntimeUserPreference('muteFocusNoiseDuringBreaks'),
    );
    const muteFocusNoisePreferenceRevision = useRef(0);
    const [userPreferencesLoading, setUserPreferencesLoading] = useState(true);
    const [pomodoroSecondsMode, setPomodoroSecondsMode] = useState(false);
    const [pomodoroConfig, setPomodoroConfig] = useState<PomodoroConfig>(NORMAL_POMODORO_CONFIG);
    const [longBreakCooldown, setLongBreakCooldown] = useState(() => (
        readPomodoroFormPreferences()?.longBreakCooldown ?? DEFAULT_LONG_BREAK_COOLDOWN
    ));
    const [pomodoroTimeAdjustmentMinutes, setPomodoroTimeAdjustmentMinutes] = useState(
        () => getRuntimeUserPreference('pomodoroTimeAdjustmentMinutes'),
    );
    const [pomodoroTimeAdjustmentDraft, setPomodoroTimeAdjustmentDraft] = useState(
        () => String(getRuntimeUserPreference('pomodoroTimeAdjustmentMinutes')),
    );
    const pomodoroTimeAdjustmentRevision = useRef(0);
    const [autoStartPomodoroSessions, setAutoStartPomodoroSessions] = useState(true);
    const [pomodoroPreferenceSaving, setPomodoroPreferenceSaving] = useState(false);
    const [pomodoroConfigLoading, setPomodoroConfigLoading] = useState(true);
    const [pomodoroConfigError, setPomodoroConfigError] = useState<string | null>(null);
    const [pomodoroSounds, setPomodoroSounds] = useState<PomodoroSound[]>(() => getCachedPomodoroSounds() ?? []);
    const [selectedPomodoroSoundId, setSelectedPomodoroSoundId] = useState(BUILT_IN_POMODORO_SOUND_ID);
    const [pomodoroSoundsLoading, setPomodoroSoundsLoading] = useState(() => getCachedPomodoroSounds() === undefined);
    const [pomodoroSoundSaving, setPomodoroSoundSaving] = useState(false);
    const pomodoroSoundSelectionRevision = useRef(0);
    const [pomodoroSoundDeleteTarget, setPomodoroSoundDeleteTarget] = useState<PomodoroSound | null>(null);
    const [pomodoroSoundDeleteAnchor, setPomodoroSoundDeleteAnchor] = useState<{ top: number; left: number } | null>(null);
    const [pomodoroSoundError, setPomodoroSoundError] = useState<string | null>(null);
    const [userPreferenceError, setUserPreferenceError] = useState<string | null>(null);
    const pomodoroUpload = useSyncExternalStore(
        subscribeToPomodoroSoundUpload,
        getPomodoroSoundUploadSnapshot,
        getPomodoroSoundUploadSnapshot,
    );
    const pomodoroUploadActive = isPomodoroSoundUploadActive(pomodoroUpload);

    useEffect(() => {
        setActiveTab(initialTab);
    }, [initialTab]);

    useEffect(() => {
        let cancelled = false;
        userService.getPreferences()
            .then(preferences => {
                if (!cancelled) {
                    setAutoStartPomodoroSessions(preferences.autoStartPomodoroSessions !== false);
                    const completedUpload = getPomodoroSoundUploadSnapshot();
                    setSelectedPomodoroSoundId(
                        completedUpload.phase === 'completed' && completedUpload.sound
                            ? completedUpload.sound.id
                            : preferences.pomodoroSoundId || BUILT_IN_POMODORO_SOUND_ID,
                    );
                    setHideCompletedTasks(!(preferences.showCompletedHomeTasks ?? true));
                    setExcludeTodayCompletedTasksState(preferences.excludeTodayCompletedTasks ?? false);
                    setHomeDayEndHour(preferences.homeDayEndHour ?? 0);
                    setShowClosedMentalThreadsState(preferences.showClosedMentalThreads ?? false);
                    setSoundEffectsEnabledState(preferences.soundEffectsEnabled ?? true);
                    setMuteFocusNoiseDuringBreaks(preferences.muteFocusNoiseDuringBreaks ?? true);
                    if (preferences.pomodoroSecondsMode != null) {
                        setPomodoroSecondsMode(preferences.pomodoroSecondsMode);
                    }
                    setLongBreakCooldown(preferences.pomodoroLongBreakCooldown ?? DEFAULT_LONG_BREAK_COOLDOWN);
                    const timeAdjustmentMinutes = preferences.pomodoroTimeAdjustmentMinutes ?? 5;
                    setPomodoroTimeAdjustmentMinutes(timeAdjustmentMinutes);
                    setPomodoroTimeAdjustmentDraft(String(timeAdjustmentMinutes));
                }
            })
            .catch(error => {
                console.error('Failed to load user preferences:', error);
                if (!cancelled) {
                    setUserPreferenceError('Could not load user preferences right now.');
                }
            })
            .finally(() => {
                if (!cancelled) setUserPreferencesLoading(false);
            });
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        const uploadedSound = pomodoroUpload.sound;
        if (!uploadedSound) return;

        setPomodoroSounds(previous => previous.some(sound => sound.id === uploadedSound.id)
            ? previous
            : [...previous, uploadedSound]);
        if (pomodoroUpload.phase === 'completed') {
            setSelectedPomodoroSoundId(uploadedSound.id);
        }
    }, [pomodoroUpload]);

    useEffect(() => {
        let cancelled = false;
        getPomodoroSounds()
            .then(sounds => {
                if (!cancelled) {
                    const uploadSound = getPomodoroSoundUploadSnapshot().sound;
                    const mergedSounds = [...sounds];
                    if (uploadSound && !mergedSounds.some(sound => sound.id === uploadSound.id)) {
                        mergedSounds.push(uploadSound);
                    }
                    setPomodoroSounds(mergedSounds);
                }
            })
            .catch(error => {
                console.error('Failed to load Pomodoro sounds:', error);
                if (!cancelled) setPomodoroSoundError('Could not load Pomodoro sounds right now.');
            })
            .finally(() => {
                if (!cancelled) setPomodoroSoundsLoading(false);
            });
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        let cancelled = false;
        getPomodoroConfig()
            .then(config => {
                if (!cancelled) {
                    setPomodoroConfig(config);
                    setPomodoroSecondsMode(config.secondsMode);
                    const storedForm = readPomodoroFormPreferences();
                    if (storedForm) setLongBreakCooldown(storedForm.longBreakCooldown);
                }
            })
            .catch(error => {
                console.error('Failed to load Pomodoro configuration:', error);
                if (!cancelled) setPomodoroConfigError('Could not load Pomodoro settings right now.');
            })
            .finally(() => {
                if (!cancelled) setPomodoroConfigLoading(false);
            });
        return () => { cancelled = true; };
    }, []);

    useEffect(() => subscribeToPomodoroFormPreferences(() => {
        const storedForm = readPomodoroFormPreferences();
        if (storedForm) setLongBreakCooldown(storedForm.longBreakCooldown);
    }), []);

    const passwordsMatch = newPassword === confirmPassword;
    const canSubmitPasswordChange = currentPassword.trim() !== '' && newPassword.trim() !== '' && confirmPassword.trim() !== '' && passwordsMatch;

    function handleTabChange(_event: SyntheticEvent, newValue: number) {
        setActiveTab(newValue);
        const tabName = newValue === 1 ? 'appearance' : newValue === 2 ? 'account' : 'general';
        setSearchParams(tabName === 'general' ? {} : { tab: tabName }, { replace: true });
    }

    async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setPasswordError(null);
        setPasswordSuccess(null);

        if (!passwordsMatch) {
            setPasswordError('New password and confirmation must match.');
            return;
        }

        if (currentPassword === newPassword) {
            setPasswordError('Choose a new password that is different from your current password.');
            return;
        }

        setPasswordSaving(true);
        try {
            await userService.changePassword({ currentPassword, newPassword });
            setPasswordSuccess('Password updated.');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setChangePasswordOpen(false);
        } catch (error) {
            if (axios.isAxiosError(error) && typeof error.response?.data === 'string') {
                setPasswordError(error.response.data);
            } else {
                setPasswordError('Could not update password right now.');
            }
        } finally {
            setPasswordSaving(false);
        }
    }

    function closePasswordChange() {
        setChangePasswordOpen(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setPasswordError(null);
        setPasswordSuccess(null);
    }

    async function handleHomeCompletedTasksChange(event: ChangeEvent<HTMLInputElement>) {
        const nextValue = event.target.checked;
        const previousValue = hideCompletedTasks;
        setHideCompletedTasks(nextValue);
        setShowCompletedHomeTasks(!nextValue);
        setUserPreferenceError(null);
        try {
            await userService.updatePreferences({ showCompletedHomeTasks: !nextValue });
        } catch (error) {
            console.error('Failed to update completed-task preference:', error);
            setHideCompletedTasks(previousValue);
            setShowCompletedHomeTasks(!previousValue);
            setUserPreferenceError('Could not save this preference right now.');
        }
    }

    async function handleHomeDayEndHourChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
        const nextValue = Number(event.target.value);
        if (!Number.isInteger(nextValue) || nextValue < 0 || nextValue > 5) return;

        const previousValue = homeDayEndHour;
        setHomeDayEndHour(nextValue);
        setHomeDayEndHourSaving(true);
        setUserPreferenceError(null);
        try {
            const preferences = await userService.updatePreferences({ homeDayEndHour: nextValue });
            setHomeDayEndHour(preferences.homeDayEndHour ?? nextValue);
        } catch (error) {
            console.error('Failed to update Home day end preference:', error);
            setHomeDayEndHour(previousValue);
            setUserPreferenceError('Could not save this preference right now.');
        } finally {
            setHomeDayEndHourSaving(false);
        }
    }

    async function handleExcludeTodayCompletedTasksChange(event: ChangeEvent<HTMLInputElement>) {
        const nextValue = event.target.checked;
        const previousValue = excludeTodayCompletedTasks;
        setExcludeTodayCompletedTasksState(nextValue);
        setExcludeTodayCompletedTasks(nextValue);
        setUserPreferenceError(null);
        try {
            await userService.updatePreferences({ excludeTodayCompletedTasks: nextValue });
        } catch (error) {
            console.error('Failed to update today completed-task preference:', error);
            setExcludeTodayCompletedTasksState(previousValue);
            setExcludeTodayCompletedTasks(previousValue);
            setUserPreferenceError('Could not save this preference right now.');
        }
    }

    async function handleShowClosedMentalThreadsChange(event: ChangeEvent<HTMLInputElement>) {
        const nextValue = event.target.checked;
        const previousValue = showClosedMentalThreads;
        setShowClosedMentalThreadsState(nextValue);
        setShowClosedMentalThreads(nextValue);
        setUserPreferenceError(null);
        try {
            await userService.updatePreferences({ showClosedMentalThreads: nextValue });
        } catch (error) {
            console.error('Failed to update mental-thread preference:', error);
            setShowClosedMentalThreadsState(previousValue);
            setShowClosedMentalThreads(previousValue);
            setUserPreferenceError('Could not save this preference right now.');
        }
    }

    async function handleSoundEffectsChange(event: ChangeEvent<HTMLInputElement>) {
        const nextValue = event.target.checked;
        const previousValue = soundEffectsEnabled;
        setSoundEffectsEnabledState(nextValue);
        setAudioFeedbackEnabled(nextValue);
        setUserPreferenceError(null);
        try {
            await userService.updatePreferences({ soundEffectsEnabled: nextValue });
        } catch (error) {
            console.error('Failed to update sound-effects preference:', error);
            setSoundEffectsEnabledState(previousValue);
            setAudioFeedbackEnabled(previousValue);
            setUserPreferenceError('Could not save this preference right now.');
        }
    }

    async function handleMuteFocusNoiseDuringBreaksChange(event: ChangeEvent<HTMLInputElement>) {
        const nextValue = event.target.checked;
        const previousValue = muteFocusNoiseDuringBreaks;
        const revision = ++muteFocusNoisePreferenceRevision.current;
        setMuteFocusNoiseDuringBreaks(nextValue);
        updateRuntimeUserPreferences({ muteFocusNoiseDuringBreaks: nextValue });
        setUserPreferenceError(null);
        try {
            await userService.updatePreferences({ muteFocusNoiseDuringBreaks: nextValue });
        } catch (error) {
            console.error('Failed to update focus-noise break preference:', error);
            if (revision !== muteFocusNoisePreferenceRevision.current) return;
            setMuteFocusNoiseDuringBreaks(previousValue);
            updateRuntimeUserPreferences({ muteFocusNoiseDuringBreaks: previousValue });
            setUserPreferenceError('Could not save this preference right now.');
        }
    }

    function handlePomodoroSecondsModeChange(event: ChangeEvent<HTMLInputElement>) {
        const nextValue = event.target.checked;
        const previousValue = pomodoroSecondsMode;
        setPomodoroSecondsMode(nextValue);
        setPomodoroSecondsModePreference(nextValue);
        setUserPreferenceError(null);
        void userService.updatePreferences({ pomodoroSecondsMode: nextValue }).catch(error => {
            console.error('Failed to update Pomodoro duration mode:', error);
            setPomodoroSecondsMode(previousValue);
            setPomodoroSecondsModePreference(previousValue);
            setUserPreferenceError('Could not save this preference right now.');
        });
    }

    function handleLongBreakCooldownChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
        const nextValue = Number(event.target.value);
        if (!Number.isInteger(nextValue) || nextValue < 1 || nextValue > 5) return;

        const previousValue = longBreakCooldown;
        setLongBreakCooldown(nextValue);
        const currentForm = readPomodoroFormPreferences() ?? createPomodoroFormDefaults(pomodoroConfig);
        savePomodoroFormPreferences({ ...currentForm, longBreakCooldown: nextValue });
        setUserPreferenceError(null);
        void userService.updatePreferences({ pomodoroLongBreakCooldown: nextValue }).catch(error => {
            console.error('Failed to update long-break preference:', error);
            setLongBreakCooldown(previousValue);
            const rollbackForm = readPomodoroFormPreferences() ?? createPomodoroFormDefaults(pomodoroConfig);
            savePomodoroFormPreferences({ ...rollbackForm, longBreakCooldown: previousValue });
            setUserPreferenceError('Could not save this preference right now.');
        });
    }

    function handlePomodoroTimeAdjustmentChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
        const rawValue = event.target.value;
        setPomodoroTimeAdjustmentDraft(rawValue);
        if (rawValue === '') return;

        const nextValue = Number(rawValue);
        if (!Number.isInteger(nextValue) || nextValue < 1 || nextValue > 60) return;
        if (nextValue === pomodoroTimeAdjustmentMinutes) return;

        const previousValue = pomodoroTimeAdjustmentMinutes;
        const revision = ++pomodoroTimeAdjustmentRevision.current;
        setPomodoroTimeAdjustmentMinutes(nextValue);
        updateRuntimeUserPreferences({ pomodoroTimeAdjustmentMinutes: nextValue });
        setUserPreferenceError(null);
        void userService.updatePreferences({ pomodoroTimeAdjustmentMinutes: nextValue }).catch(error => {
            console.error('Failed to update Pomodoro time adjustment:', error);
            if (pomodoroTimeAdjustmentRevision.current !== revision) return;
            setPomodoroTimeAdjustmentMinutes(previousValue);
            setPomodoroTimeAdjustmentDraft(String(previousValue));
            updateRuntimeUserPreferences({ pomodoroTimeAdjustmentMinutes: previousValue });
            setUserPreferenceError('Could not save this preference right now.');
        });
    }

    async function handleAutoStartPomodoroSessionsChange(event: ChangeEvent<HTMLInputElement>) {
        const nextValue = event.target.checked;
        const previousValue = autoStartPomodoroSessions;
        setAutoStartPomodoroSessions(nextValue);
        setPomodoroPreferenceSaving(true);
        setPomodoroConfigError(null);

        try {
            await userService.updatePreferences({ autoStartPomodoroSessions: nextValue });
        } catch (error) {
            console.error('Failed to update Pomodoro preferences:', error);
            setAutoStartPomodoroSessions(previousValue);
            setPomodoroConfigError('Could not save this preference right now.');
        } finally {
            setPomodoroPreferenceSaving(false);
        }
    }

    async function applyPomodoroSound(sound: PomodoroSound) {
        const url = await getPomodoroSoundAudioUrl(sound);
        setWhiteNoiseSource({ id: sound.id, name: sound.name, url });
    }

    async function handlePomodoroSoundChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
        const nextValue = event.target.value;
        const previousValue = selectedPomodoroSoundId;
        const sound = nextValue === BUILT_IN_POMODORO_SOUND_ID
            ? BUILT_IN_POMODORO_SOUND
            : pomodoroSounds.find(candidate => candidate.id === nextValue);
        if (!sound) return;

        clearPomodoroSoundUploadResult();
        const selectionRevision = ++pomodoroSoundSelectionRevision.current;
        setSelectedPomodoroSoundId(nextValue);
        setPomodoroSoundError(null);
        void selectWhiteNoiseSound(sound).catch(error => {
            if (selectionRevision !== pomodoroSoundSelectionRevision.current) return;
            console.error('Failed to update Pomodoro sound:', error);
            setSelectedPomodoroSoundId(previousValue);
            setPomodoroSoundError('Could not save this Pomodoro sound right now.');

            const previousSound = previousValue === BUILT_IN_POMODORO_SOUND_ID
                ? BUILT_IN_POMODORO_SOUND
                : pomodoroSounds.find(candidate => candidate.id === previousValue);
            if (previousSound) void selectWhiteNoiseSound(previousSound).catch(rollbackError => {
                console.error('Failed to restore the previous Pomodoro sound:', rollbackError);
            });
        });
    }

    async function handlePomodoroSoundUpload(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        if (isPomodoroSoundUploadActive(getPomodoroSoundUploadSnapshot())) return;

        if (file.size > MAX_POMODORO_SOUND_SIZE_BYTES || !file.name.toLowerCase().endsWith('.mp3')) {
            setPomodoroSoundError('Choose an MP3 file that is 25 MB or smaller.');
            return;
        }

        setPomodoroSoundSaving(true);
        setPomodoroSoundError(null);
        try {
            const uploadedSound = await startPomodoroSoundUpload(file);
            // A pending manual selection must not roll back over this newly
            // accepted upload when its slower request finishes later.
            pomodoroSoundSelectionRevision.current += 1;
            setPomodoroSounds(previous => previous.some(sound => sound.id === uploadedSound.id)
                ? previous
                : [...previous, uploadedSound]);
            setSelectedPomodoroSoundId(uploadedSound.id);
        } catch (error) {
            if (!isPomodoroSoundUploadCancellation(error)) {
                setPomodoroSoundError(getPomodoroSoundUploadErrorMessage(error));
            }
        } finally {
            setPomodoroSoundSaving(false);
        }
    }

    async function handlePomodoroSoundDelete() {
        const sound = pomodoroSoundDeleteTarget;
        if (!sound || pomodoroSoundSaving) return;

        clearPomodoroSoundUploadResult();
        setPomodoroSoundSaving(true);
        setPomodoroSoundError(null);
        try {
            await deletePomodoroSound(sound.id);
            setPomodoroSounds(previous => previous.filter(candidate => candidate.id !== sound.id));
            if (selectedPomodoroSoundId === sound.id) {
                await userService.updatePreferences({ pomodoroSoundId: BUILT_IN_POMODORO_SOUND_ID });
                setSelectedPomodoroSoundId(BUILT_IN_POMODORO_SOUND_ID);
                await applyPomodoroSound(BUILT_IN_POMODORO_SOUND);
            }
            setPomodoroSoundDeleteTarget(null);
        } catch (error) {
            console.error('Failed to delete Pomodoro sound:', error);
            setPomodoroSoundError('Could not delete that Pomodoro sound right now.');
        } finally {
            setPomodoroSoundSaving(false);
        }
    }

    const displayName = user ? `${user.firstName} ${user.lastName}`.trim() || user.username : 'Unknown user';
    const userInitials = user
        ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() || user.username?.[0]?.toUpperCase() || '?'
        : '?';
    const pomodoroUploadProgress = pomodoroUpload.phase === 'uploading' || pomodoroUpload.phase === 'saving'
        ? pomodoroUpload.progress
        : null;
    const pomodoroUploadError = pomodoroUpload.error;

    return (
        <PageWrapper>
            <Box sx={{ flex: 1, width: '100%' }}>
                <Box sx={{ maxWidth: 760, width: '100%', mx: 'auto', pt: 10, pb: 8, px: { xs: 2, md: 4 } }}>
                    <Typography variant="h4" color="text.primary" sx={{ mb: 2, fontWeight: 400, textAlign: 'left' }}>
                        Settings
                    </Typography>

                    <Tabs
                        value={activeTab}
                        onChange={handleTabChange}
                        variant="scrollable"
                        allowScrollButtonsMobile
                        sx={{
                            mb: 3,
                            minHeight: 40,
                            '& .MuiTabs-flexContainer': {
                                gap: 1,
                            },
                            '& .MuiTab-root': {
                                minHeight: 40,
                                px: 1.5,
                                py: 0.75,
                                borderRadius: 2,
                                textTransform: 'none',
                                fontSize: '0.92rem',
                                fontWeight: 500,
                                color: 'text.secondary',
                                alignItems: 'flex-start',
                            },
                            '& .Mui-selected': {
                                color: 'text.primary',
                                backgroundColor: 'background.paper',
                            },
                            '& .MuiTabs-indicator': {
                                display: 'none',
                            },
                        }}
                    >
                        <Tab label="Behavior" />
                        <Tab label="Appearance" />
                        <Tab label="Account" />
                    </Tabs>

                    <Stack spacing={2.5}>
                        {activeTab === 0 && (
                            <>
                                {userPreferenceError && (
                                    <Alert severity="warning" onClose={() => setUserPreferenceError(null)}>
                                        {userPreferenceError}
                                    </Alert>
                                )}
                                <Box sx={sectionCardSx}>
                                    <Box sx={sectionHeadingSx}>
                                        <HomeOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                            Home & Tasks
                                        </Typography>
                                    </Box>

                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                                        <Box sx={{ textAlign: 'left' }}>
                                            <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                                Hide completed tasks
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {hideCompletedTasksDescription}
                                            </Typography>
                                        </Box>
                                        <Switch
                                            checked={hideCompletedTasks}
                                            onChange={handleHomeCompletedTasksChange}
                                            disabled={userPreferencesLoading}
                                            inputProps={{ 'aria-label': 'Hide completed tasks' }}
                                        />
                                    </Box>

                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mt: 2 }}>
                                        <Box sx={{ textAlign: 'left' }}>
                                            <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                                When does the day end?
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Home and Tasks keep the previous day active until this time.
                                            </Typography>
                                        </Box>
                                        <TextField
                                            select
                                            size="small"
                                            value={homeDayEndHour}
                                            onChange={event => void handleHomeDayEndHourChange(event)}
                                            disabled={userPreferencesLoading || homeDayEndHourSaving}
                                            inputProps={{ 'aria-label': 'Home day ends at' }}
                                            sx={{ width: 142, flexShrink: 0 }}
                                        >
                                            {Array.from({ length: 6 }, (_, hour) => (
                                                <MenuItem key={hour} value={hour}>
                                                    {hour === 0 ? '12 a.m.' : `${hour} a.m.`}
                                                </MenuItem>
                                            ))}
                                        </TextField>
                                    </Box>

                                    {hideCompletedTasks && (
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mt: 2 }}>
                                            <Box sx={{ textAlign: 'left' }}>
                                                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                                    Hide today&apos;s completed tasks in Home page
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    {excludeTodayCompletedTasksDescription}
                                                </Typography>

                                            </Box>
                                            <Switch
                                                checked={excludeTodayCompletedTasks}
                                                onChange={handleExcludeTodayCompletedTasksChange}
                                                disabled={userPreferencesLoading}
                                                inputProps={{ 'aria-label': "Exclude today's completed tasks in Home page" }}
                                            />
                                        </Box>
                                    )}
                                </Box>

                                <Box sx={sectionCardSx}>
                                    <Box sx={sectionHeadingSx}>
                                        <VolumeUpOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                            Sound effects
                                        </Typography>
                                    </Box>

                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                                        <Box sx={{ textAlign: 'left' }}>
                                            <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                                Play sound effects
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {soundEffectsDescription}
                                            </Typography>
                                        </Box>
                                        <Switch
                                            checked={soundEffectsEnabled}
                                            onChange={handleSoundEffectsChange}
                                            disabled={userPreferencesLoading}
                                            inputProps={{ 'aria-label': 'Play sound effects' }}
                                        />
                                    </Box>
                                </Box>

                                <Box sx={sectionCardSx}>
                                    <Box sx={sectionHeadingSx}>
                                        <PsychologyOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                            Mental threads
                                        </Typography>
                                    </Box>

                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                                        <Box sx={{ textAlign: 'left' }}>
                                            <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                                Show closed threads
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {showClosedMentalThreadsDescription}
                                            </Typography>
                                        </Box>
                                        <Switch
                                            checked={showClosedMentalThreads}
                                            onChange={handleShowClosedMentalThreadsChange}
                                            disabled={userPreferencesLoading}
                                            inputProps={{ 'aria-label': 'Show closed mental threads' }}
                                        />
                                    </Box>
                                </Box>

                                {/* Electron has no browser push service, so remote push cannot reach the desktop app. */}
                                {!isDesktopApp && <BrowserNotificationsSection />}
                                <CheckupSettingsSection />
                                <ActivitiesSection cardSx={sectionCardSx} headingSx={sectionHeadingSx} />

                                <Box sx={sectionCardSx}>
                                    <Box sx={sectionHeadingSx}>
                                        <TimerOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                            Pomodoro
                                        </Typography>
                                    </Box>

                                    {pomodoroConfigError && (
                                        <Alert severity="warning" sx={{ mb: 2 }}>
                                            {pomodoroConfigError}
                                        </Alert>
                                    )}
                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 2 }}>
                                        <Box sx={{ textAlign: 'left' }}>
                                            <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                                Automatically start breaks and focus sessions
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {pomodoroAutoStartDescription}
                                            </Typography>
                                        </Box>
                                        <Switch
                                            checked={autoStartPomodoroSessions}
                                            onChange={handleAutoStartPomodoroSessionsChange}
                                            disabled={userPreferencesLoading || pomodoroPreferenceSaving}
                                            inputProps={{ 'aria-label': 'Automatically start Pomodoro breaks and focus sessions' }}
                                        />
                                    </Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 2 }}>
                                        <Box sx={{ textAlign: 'left' }}>
                                            <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                                Long break frequency
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {pomodoroLongBreakDescription}
                                            </Typography>
                                        </Box>
                                        <TextField
                                            select
                                            size="small"
                                            label="Long break every"
                                            value={longBreakCooldown}
                                            onChange={handleLongBreakCooldownChange}
                                            disabled={userPreferencesLoading}
                                            inputProps={{ 'aria-label': 'Long break frequency in focus sessions' }}
                                            sx={{ minWidth: 150, flexShrink: 0 }}
                                        >
                                            {Array.from({ length: 5 }, (_, index) => index + 1).map(value => (
                                                <MenuItem key={value} value={value}>
                                                    {value} {value === 1 ? 'session' : 'sessions'}
                                                </MenuItem>
                                            ))}
                                        </TextField>
                                    </Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 2 }}>
                                        <Box sx={{ textAlign: 'left' }}>
                                            <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                                Timer adjustment
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {pomodoroTimeAdjustmentDescription}
                                            </Typography>
                                        </Box>
                                        <TextField
                                            type="number"
                                            size="small"
                                            label="Minutes"
                                            value={pomodoroTimeAdjustmentDraft}
                                            onChange={handlePomodoroTimeAdjustmentChange}
                                            onBlur={() => {
                                                const value = Number(pomodoroTimeAdjustmentDraft);
                                                if (!Number.isInteger(value) || value < 1 || value > 60) {
                                                    setPomodoroTimeAdjustmentDraft(String(pomodoroTimeAdjustmentMinutes));
                                                }
                                            }}
                                            disabled={userPreferencesLoading}
                                            inputProps={{
                                                min: 1,
                                                max: 60,
                                                step: 1,
                                                'aria-label': 'Pomodoro timer adjustment per click in minutes',
                                            }}
                                            sx={{ width: 112, flexShrink: 0 }}
                                        />
                                    </Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                                        <Box sx={{ textAlign: 'left' }}>
                                            <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                                Use short Pomodoro durations
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {pomodoroSecondsModeDescription}
                                            </Typography>
                                        </Box>
                                        <Switch
                                            checked={pomodoroSecondsMode}
                                            onChange={handlePomodoroSecondsModeChange}
                                            disabled={pomodoroConfigLoading || userPreferencesLoading}
                                            inputProps={{ 'aria-label': 'Use short Pomodoro durations in seconds' }}
                                        />
                                    </Box>

                                    <Box sx={{ mt: 2, pt: 2, borderTop: theme => `1px solid ${theme.palette.divider}` }}>
                                        <Box sx={sectionHeadingSx}>
                                            <MusicNoteOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                                            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                                Focus sound
                                            </Typography>
                                        </Box>
                                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, textAlign: 'left' }}>
                                            {pomodoroSoundDescription}
                                        </Typography>
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 1.5 }}>
                                            <Box sx={{ textAlign: 'left' }}>
                                                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                                    Mute focus noise during breaks
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    {muteFocusNoiseDuringBreaksDescription}
                                                </Typography>
                                            </Box>
                                            <Switch
                                                checked={muteFocusNoiseDuringBreaks}
                                                onChange={handleMuteFocusNoiseDuringBreaksChange}
                                                disabled={userPreferencesLoading}
                                                inputProps={{ 'aria-label': 'Mute focus noise during breaks' }}
                                            />
                                        </Box>
                                        {(pomodoroSoundError || pomodoroUploadError) && (
                                            <Alert severity="warning" sx={{ mb: 1.5 }}>
                                                {pomodoroSoundError || pomodoroUploadError}
                                            </Alert>
                                        )}
                                        <TextField
                                            select
                                            fullWidth
                                            size="small"
                                            label="Sound used during focus"
                                            value={selectedPomodoroSoundId}
                                            onChange={handlePomodoroSoundChange}
                                            disabled={pomodoroSoundsLoading || pomodoroSoundSaving || pomodoroUploadActive || userPreferencesLoading}
                                        >
                                            <MenuItem value={BUILT_IN_POMODORO_SOUND_ID}>
                                                {BUILT_IN_POMODORO_SOUND.name}
                                            </MenuItem>
                                            {pomodoroSounds.map(sound => (
                                                <MenuItem
                                                    key={sound.id}
                                                    value={sound.id}
                                                    onMouseEnter={() => {
                                                        void preloadPomodoroSoundAudio(sound).catch(error => {
                                                            console.warn('Could not preload Pomodoro sound:', error);
                                                        });
                                                    }}
                                                    onFocus={() => {
                                                        void preloadPomodoroSoundAudio(sound).catch(error => {
                                                            console.warn('Could not preload Pomodoro sound:', error);
                                                        });
                                                    }}
                                                >
                                                    {sound.name}
                                                </MenuItem>
                                            ))}
                                        </TextField>
                                        {pomodoroSounds.length > 0 && (
                                            <Stack spacing={0.5} sx={{ mt: 1 }}>
                                                {pomodoroSounds.map(sound => (
                                                    <Box
                                                        key={sound.id}
                                                        sx={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'space-between',
                                                            gap: 1,
                                                            pl: 1.5,
                                                            borderRadius: 1.5,
                                                            '&:hover': { backgroundColor: 'action.hover' },
                                                        }}
                                                    >
                                                        <Typography variant="body2" noWrap sx={{ minWidth: 0 }}>
                                                            {sound.name}
                                                        </Typography>
                                                        <IconButton
                                                            size="small"
                                                            aria-label={`Delete ${sound.name}`}
                                                            onClick={event => {
                                                                setPomodoroSoundError(null);
                                                                setPomodoroSoundDeleteTarget(sound);
                                                                const bounds = event.currentTarget.getBoundingClientRect();
                                                                setPomodoroSoundDeleteAnchor({ top: bounds.bottom, left: bounds.left });
                                                            }}
                                                            disabled={pomodoroSoundSaving || pomodoroUploadActive || userPreferencesLoading}
                                                            sx={{
                                                                flexShrink: 0,
                                                                color: 'text.secondary',
                                                                '&:hover': {
                                                                    color: 'error.main',
                                                                    backgroundColor: 'action.hover',
                                                                },
                                                            }}
                                                        >
                                                            <DeleteOutlineIcon fontSize="small" />
                                                        </IconButton>
                                                    </Box>
                                                ))}
                                            </Stack>
                                        )}
                                        {pomodoroUploadProgress !== null && (
                                            <Box sx={{ mt: 1.5 }}>
                                                <LinearProgress
                                                    variant={pomodoroUploadProgress < 100 ? 'determinate' : 'indeterminate'}
                                                    value={pomodoroUploadProgress}
                                                    aria-label="Uploading Pomodoro sound"
                                                />
                                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mt: 0.5 }}>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {pomodoroUpload.phase === 'uploading'
                                                            ? `${pomodoroUpload.fileName ?? 'Sound'} — ${pomodoroUploadProgress ?? 0}% uploaded`
                                                            : 'Saving sound...'}
                                                    </Typography>
                                                    {pomodoroUpload.phase === 'uploading' && (
                                                        <Button
                                                            size="small"
                                                            color="inherit"
                                                            onClick={cancelPomodoroSoundUpload}
                                                            sx={{ minWidth: 0, textTransform: 'none' }}
                                                        >
                                                            Cancel upload
                                                        </Button>
                                                    )}
                                                </Box>
                                            </Box>
                                        )}
                                        <Button
                                            component="label"
                                            variant="outlined"
                                            size="small"
                                            startIcon={<CloudUploadOutlinedIcon />}
                                            disabled={pomodoroSoundSaving || pomodoroUploadActive || userPreferencesLoading}
                                            sx={{ mt: 1.5, textTransform: 'none' }}
                                        >
                                            Upload MP3
                                            <input
                                                hidden
                                                type="file"
                                                accept=".mp3,audio/mpeg"
                                                onChange={handlePomodoroSoundUpload}
                                            />
                                        </Button>
                                    </Box>
                                </Box>
                            </>
                        )}

                        {activeTab === 2 && (
                            <Box sx={sectionCardSx}>
                                <Box sx={sectionHeadingSx}>
                                    <PersonOutlineIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                        Account
                                    </Typography>
                                </Box>

                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2, borderRadius: 2, backgroundColor: 'action.hover' }}>
                                    <Box sx={{ width: 48, height: 48, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, backgroundColor: 'primary.main', color: 'primary.contrastText', fontWeight: 700 }}>
                                        {userInitials}
                                    </Box>
                                    <Box sx={{ minWidth: 0, textAlign: 'left' }}>
                                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }} noWrap>
                                            {displayName}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary" noWrap>
                                            {user?.email || 'No email available'}
                                        </Typography>
                                    </Box>
                                </Box>

                                <Box sx={{ mt: 2.5 }}>
                                    <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: '0.08em' }}>
                                        Profile details
                                    </Typography>
                                    <Stack spacing={1.25} sx={{ mt: 0.5 }}>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, textAlign: 'left' }}>
                                            <Typography variant="body2" color="text.secondary">Name</Typography>
                                            <Typography variant="body2" sx={{ fontWeight: 500, textAlign: 'right' }}>{displayName}</Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, textAlign: 'left' }}>
                                            <Typography variant="body2" color="text.secondary">Username</Typography>
                                            <Typography variant="body2" sx={{ fontWeight: 500, textAlign: 'right' }}>{user?.username || 'No username available'}</Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, textAlign: 'left' }}>
                                            <Typography variant="body2" color="text.secondary">Email</Typography>
                                            <Typography variant="body2" sx={{ fontWeight: 500, textAlign: 'right', overflowWrap: 'anywhere' }}>{user?.email || 'No email available'}</Typography>
                                        </Box>
                                    </Stack>
                                </Box>

                                <DesktopStorageSection />
                                <ScreenTimeSection />
                                <LocalBackupSection />

                                {/* Local desktop mode has one implicit user, so there is no password or session to manage. */}
                                {!isLocalDesktopMode && (
                                    <>
                                    <Box sx={{ mt: 3, pt: 3, borderTop: theme => `1px solid ${theme.palette.divider}` }}>
                                        <Box sx={sectionHeadingSx}>
                                            <SecurityOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                                            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                                Account actions
                                            </Typography>
                                        </Box>

                                        <Button
                                            fullWidth
                                            variant="outlined"
                                            color="inherit"
                                            startIcon={<SecurityOutlinedIcon />}
                                            aria-expanded={changePasswordOpen}
                                            onClick={() => {
                                                if (changePasswordOpen) closePasswordChange();
                                                else {
                                                    setPasswordSuccess(null);
                                                    setChangePasswordOpen(true);
                                                }
                                            }}
                                            sx={{ justifyContent: 'flex-start', borderRadius: 2, py: 1.1, textTransform: 'none' }}
                                        >
                                            {changePasswordOpen ? 'Cancel password change' : 'Change password'}
                                        </Button>

                                        {changePasswordOpen && (
                                            <Box component="form" onSubmit={handlePasswordSubmit} sx={{ mt: 2.5 }}>
                                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2, textAlign: 'left' }}>
                                                    Confirm your current password before choosing a new one.
                                                </Typography>

                                                <Stack spacing={1.5}>
                                                    {passwordError && <Alert severity="error">{passwordError}</Alert>}
                                                    {passwordSuccess && <Alert severity="success">{passwordSuccess}</Alert>}
                                                    <TextField
                                                        label="Current password"
                                                        type="password"
                                                        value={currentPassword}
                                                        onChange={(event) => setCurrentPassword(event.target.value)}
                                                        fullWidth
                                                        autoComplete="current-password"
                                                    />
                                                    <TextField
                                                        label="New password"
                                                        type="password"
                                                        value={newPassword}
                                                        onChange={(event) => setNewPassword(event.target.value)}
                                                        fullWidth
                                                        autoComplete="new-password"
                                                    />
                                                    <TextField
                                                        label="Confirm new password"
                                                        type="password"
                                                        value={confirmPassword}
                                                        onChange={(event) => setConfirmPassword(event.target.value)}
                                                        error={confirmPassword !== '' && !passwordsMatch}
                                                        helperText={confirmPassword !== '' && !passwordsMatch ? 'Passwords must match.' : ' '}
                                                        fullWidth
                                                        autoComplete="new-password"
                                                    />
                                                    <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
                                                        <Button
                                                            type="submit"
                                                            variant="contained"
                                                            disabled={!canSubmitPasswordChange || passwordSaving}
                                                            sx={{ borderRadius: 2, py: 1.1, px: 2.5, textTransform: 'none' }}
                                                            startIcon={passwordSaving ? <CircularProgress size={18} color="inherit" /> : undefined}
                                                        >
                                                            {passwordSaving ? 'Updating...' : 'Update password'}
                                                        </Button>
                                                    </Box>
                                                </Stack>
                                            </Box>
                                        )}
                                    </Box>

                                    <Box sx={{ mt: 3, pt: 3, borderTop: theme => `1px solid ${theme.palette.divider}` }}>
                                        <Box sx={sectionHeadingSx}>
                                            <SecurityOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                                            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                                Session
                                            </Typography>
                                        </Box>

                                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, textAlign: 'left' }}>
                                            You are currently signed in. Logging out will end your session on this device.
                                        </Typography>

                                        <Button
                                            fullWidth
                                            variant="outlined"
                                            color="inherit"
                                            startIcon={<LogoutIcon />}
                                            onClick={event => {
                                                const bounds = event.currentTarget.getBoundingClientRect();
                                                setLogoutAnchorPosition({ top: bounds.bottom, left: bounds.left });
                                                setLogoutDialogOpen(true);
                                            }}
                                            sx={{ justifyContent: 'flex-start', borderRadius: 2, py: 1.1, textTransform: 'none' }}
                                        >
                                            Log out
                                        </Button>
                                    </Box>
                                    </>
                                )}
                            </Box>
                        )}

                        {activeTab === 1 && (
                            <Box sx={sectionCardSx}>
                            <Box sx={sectionHeadingSx}>
                                <PaletteOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                    Appearance
                                </Typography>
                            </Box>

                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, textAlign: 'left' }}>
                                Choose the mode that stays out of the way, then pick the accent color that should carry buttons, highlights, and charts.
                            </Typography>

                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                                <Button
                                    variant={darkMode ? 'outlined' : 'contained'}
                                    startIcon={<LightModeIcon />}
                                    onClick={() => setTheme('light')}
                                    sx={{ flex: 1, borderRadius: 2, py: 1.1, textTransform: 'none' }}
                                >
                                    Light
                                </Button>
                                <Button
                                    variant={darkMode ? 'contained' : 'outlined'}
                                    startIcon={<NightlightIcon />}
                                    onClick={() => setTheme('dark')}
                                    sx={{ flex: 1, borderRadius: 2, py: 1.1, textTransform: 'none' }}
                                >
                                    Dark
                                </Button>
                            </Stack>

                            <Box sx={{ mt: 2.5 }}>
                                <Typography variant="subtitle2" sx={{ mb: 1.25, fontWeight: 600, textAlign: 'left' }}>
                                    Theme color
                                </Typography>
                                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                                    {accentColorOptions.map((option) => {
                                        const selected = accentColor === option.value;
                                        return (
                                            <Button
                                                key={option.value}
                                                variant="outlined"
                                                color={selected ? 'primary' : 'inherit'}
                                                onClick={() => setAccentColor(option.value)}
                                                startIcon={
                                                    <Box
                                                        sx={{
                                                            width: 14,
                                                            height: 14,
                                                            borderRadius: '50%',
                                                            backgroundColor: option.swatch,
                                                            border: '1px solid rgba(0,0,0,0.12)',
                                                        }}
                                                    />
                                                }
                                                endIcon={selected ? <CheckIcon /> : undefined}
                                                sx={{
                                                    flex: 1,
                                                    borderRadius: 2,
                                                    py: 1.1,
                                                    textTransform: 'none',
                                                    backgroundColor: selected ? 'action.selected' : 'transparent',
                                                    borderColor: selected ? 'primary.main' : 'divider',
                                                    '&:hover': {
                                                        backgroundColor: selected ? 'action.selected' : 'action.hover',
                                                        borderColor: selected ? 'primary.main' : 'text.secondary',
                                                    },
                                                }}
                                            >
                                                {option.label}
                                            </Button>
                                        );
                                    })}
                                </Stack>
                            </Box>
                        </Box>
                        )}

                    </Stack>
                    <Box sx={{ mt: 4 }}><AppVersionInfo /></Box>
                </Box>
            </Box>
            <CompactPopover
                open={logoutDialogOpen}
                onClose={() => setLogoutDialogOpen(false)}
                anchorPosition={logoutAnchorPosition ?? undefined}
                maxWidth="xs"
            >
                <DialogTitle>Log out?</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        You will be signed out of the app and returned to the login screen.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setLogoutDialogOpen(false)}>Cancel</Button>
                    <Button
                        color="error"
                        onClick={() => {
                            setLogoutDialogOpen(false);
                            logout();
                        }}
                    >
                        Log out
                    </Button>
                </DialogActions>
            </CompactPopover>
            <CompactPopover
                open={pomodoroSoundDeleteTarget !== null}
                onClose={() => { if (!pomodoroSoundSaving) setPomodoroSoundDeleteTarget(null); }}
                anchorPosition={pomodoroSoundDeleteAnchor ?? undefined}
                fullWidth
                maxWidth="xs"
                compactConfirmation
            >
                <DialogTitle>Delete “{pomodoroSoundDeleteTarget?.name}”?</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        This focus sound will be permanently deleted. This cannot be undone.
                    </DialogContentText>
                    {pomodoroSoundError && <Alert severity="error" sx={{ mt: 2 }}>{pomodoroSoundError}</Alert>}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setPomodoroSoundDeleteTarget(null)} disabled={pomodoroSoundSaving}>Cancel</Button>
                    <Button color="error" variant="contained" onClick={() => void handlePomodoroSoundDelete()} disabled={pomodoroSoundSaving}>
                        {pomodoroSoundSaving ? <CircularProgress size={18} color="inherit" /> : 'Delete'}
                    </Button>
                </DialogActions>
            </CompactPopover>
        </PageWrapper>
    );
}

export default SettingsPage;
