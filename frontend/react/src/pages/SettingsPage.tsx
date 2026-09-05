import { ChangeEvent, FormEvent, SyntheticEvent, useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, MenuItem, Stack, Switch, Tab, Tabs, TextField, Typography } from '@mui/material';
import LightModeIcon from '@mui/icons-material/LightMode';
import NightlightIcon from '@mui/icons-material/Nightlight';
import LogoutIcon from '@mui/icons-material/Logout';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined';
import QueryStatsOutlinedIcon from '@mui/icons-material/QueryStatsOutlined';
import SecurityOutlinedIcon from '@mui/icons-material/SecurityOutlined';
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import CheckIcon from '@mui/icons-material/Check';
import PsychologyOutlinedIcon from '@mui/icons-material/PsychologyOutlined';
import VolumeUpOutlinedIcon from '@mui/icons-material/VolumeUpOutlined';
import { PageWrapper } from '../components/PageWrapper.tsx';
import { useUser } from '../hooks/useUser';
import { accentColorOptions } from '../contexts/themeOptions';
import { useAppTheme } from '../hooks/useAppTheme';
import { useSearchParams } from 'react-router-dom';
import { userService } from '../services/api/userService.ts';
import axios from 'axios';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { SHOW_COMPLETED_HOME_TASKS_STORAGE_KEY } from '../services/utils/homePreferences.ts';
import { statService } from '../services/api/statService.ts';
import { getPomodoroConfig, setPomodoroSecondsModePreference } from '../services/api/pomodoroConfigService.ts';
import { getShowClosedMentalThreads, setShowClosedMentalThreads } from '../services/utils/mentalThreadPreferences.ts';
import { isAudioFeedbackEnabled, setAudioFeedbackEnabled } from '../services/audioFeedback.ts';

const sectionCardSx = {
    backgroundColor: 'background.paper',
    borderRadius: 3,
    px: 2.5,
    py: 2.25,
    boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
};

const sectionHeadingSx = {
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    mb: 1.5,
};

const showCompletedTasksDescription = 'Keep completed tasks visible in today\'s Home and Tasks lists.';
const numericStatsAverageDescription = 'Include days without a logged numeric value as 0 when calculating averages.';
const pomodoroAutoStartDescription = 'Start each break and focus session automatically, or wait for you to start the next phase.';
const pomodoroSecondsModeDescription = 'Use 10-second focus and break durations instead of the normal 25/5/15-minute defaults.';
const showClosedMentalThreadsDescription = 'Keep closed threads visible in the mental threads list.';
const soundEffectsDescription = 'Play short musical cues when you complete, capture, schedule, or rate something.';
const DEFAULT_CHECKUP_INTERVAL_MINUTES = 180;
const DEFAULT_CHECKUP_START_TIME = '09:00';
const DEFAULT_CHECKUP_TIMES_PER_DAY = 5;

const checkupIntervalOptions = [
    { value: 15, label: '15 minutes' },
    { value: 30, label: '30 minutes' },
    { value: 60, label: '1 hour' },
    { value: 120, label: '2 hours' },
    { value: 180, label: '3 hours' },
    { value: 240, label: '4 hours' },
    { value: 360, label: '6 hours' },
    { value: 480, label: '8 hours' },
    { value: 720, label: '12 hours' },
];

function dateFromTime(value: string): Date {
    const match = /^(\d{2}):(\d{2})/.exec(value);
    const date = new Date();
    date.setHours(match ? Number(match[1]) : 9, match ? Number(match[2]) : 0, 0, 0);
    return date;
}

function timeFromDate(value: Date): string {
    return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
}

function CheckupStartTimeField({ value, disabled, onChange }: { value: string; disabled: boolean; onChange: (value: string) => void }) {
    return (
        <LocalizationProvider dateAdapter={AdapterDateFns}>
            <TimePicker
                label="Start at"
                value={dateFromTime(value)}
                onChange={nextValue => {
                    if (nextValue) onChange(timeFromDate(nextValue));
                }}
                disabled={disabled}
                ampm={false}
                slotProps={{
                    textField: {
                        fullWidth: true,
                        size: 'small',
                    },
                    actionBar: { actions: ['cancel', 'accept'] },
                    desktopPaper: {
                        sx: {
                            borderRadius: 3,
                            backgroundColor: 'background.paper',
                            backgroundImage: 'none',
                            border: theme => `1px solid ${theme.palette.divider}`,
                        },
                    },
                    mobilePaper: {
                        sx: {
                            borderRadius: 3,
                            backgroundColor: 'background.paper',
                            backgroundImage: 'none',
                            border: theme => `1px solid ${theme.palette.divider}`,
                        },
                    },
                }}
            />
        </LocalizationProvider>
    );
}

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
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
    const [passwordSaving, setPasswordSaving] = useState(false);
    const [changePasswordOpen, setChangePasswordOpen] = useState(false);
    const [showCompletedHomeTasks, setShowCompletedHomeTasks] = useState(() => (
        localStorage.getItem(SHOW_COMPLETED_HOME_TASKS_STORAGE_KEY) !== 'false'
    ));
    const [showClosedMentalThreads, setShowClosedMentalThreadsState] = useState(getShowClosedMentalThreads);
    const [soundEffectsEnabled, setSoundEffectsEnabledState] = useState(isAudioFeedbackEnabled);
    const [includeUnloggedNumericDaysAsZero, setIncludeUnloggedNumericDaysAsZero] = useState(false);
    const [userPreferencesLoading, setUserPreferencesLoading] = useState(true);
    const [numericStatsPreferenceSaving, setNumericStatsPreferenceSaving] = useState(false);
    const [numericStatsPreferenceError, setNumericStatsPreferenceError] = useState<string | null>(null);
    const [pomodoroSecondsMode, setPomodoroSecondsMode] = useState(false);
    const [autoStartPomodoroSessions, setAutoStartPomodoroSessions] = useState(true);
    const [pomodoroPreferenceSaving, setPomodoroPreferenceSaving] = useState(false);
    const [pomodoroConfigLoading, setPomodoroConfigLoading] = useState(true);
    const [pomodoroConfigError, setPomodoroConfigError] = useState<string | null>(null);
    const [checkupNotificationsEnabled, setCheckupNotificationsEnabled] = useState(true);
    const [checkupIntervalMinutes, setCheckupIntervalMinutes] = useState(DEFAULT_CHECKUP_INTERVAL_MINUTES);
    const [checkupStartTime, setCheckupStartTime] = useState(DEFAULT_CHECKUP_START_TIME);
    const [checkupTimesPerDay, setCheckupTimesPerDay] = useState(DEFAULT_CHECKUP_TIMES_PER_DAY);
    const [checkupPreferenceSaving, setCheckupPreferenceSaving] = useState(false);
    const [checkupPreferenceError, setCheckupPreferenceError] = useState<string | null>(null);

    useEffect(() => {
        setActiveTab(initialTab);
    }, [initialTab]);

    useEffect(() => {
        localStorage.setItem(SHOW_COMPLETED_HOME_TASKS_STORAGE_KEY, String(showCompletedHomeTasks));
    }, [showCompletedHomeTasks]);

    useEffect(() => {
        let cancelled = false;
        userService.getPreferences()
            .then(preferences => {
                if (!cancelled) {
                    setIncludeUnloggedNumericDaysAsZero(preferences.includeUnloggedNumericDaysAsZero);
                    setAutoStartPomodoroSessions(preferences.autoStartPomodoroSessions !== false);
                    setCheckupNotificationsEnabled(preferences.checkupNotificationsEnabled !== false);
                    setCheckupIntervalMinutes(preferences.checkupIntervalMinutes || DEFAULT_CHECKUP_INTERVAL_MINUTES);
                    setCheckupStartTime(preferences.checkupStartTime?.slice(0, 5) || DEFAULT_CHECKUP_START_TIME);
                    setCheckupTimesPerDay(preferences.checkupTimesPerDay || DEFAULT_CHECKUP_TIMES_PER_DAY);
                }
            })
            .catch(error => {
                console.error('Failed to load user preferences:', error);
                if (!cancelled) {
                    setNumericStatsPreferenceError('Could not load user preferences right now.');
                    setCheckupPreferenceError('Could not load check-up settings right now.');
                }
            })
            .finally(() => {
                if (!cancelled) setUserPreferencesLoading(false);
            });
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        let cancelled = false;
        getPomodoroConfig()
            .then(config => {
                if (!cancelled) setPomodoroSecondsMode(config.secondsMode);
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

    async function handleNumericStatsPreferenceChange(event: ChangeEvent<HTMLInputElement>) {
        const nextValue = event.target.checked;
        const previousValue = includeUnloggedNumericDaysAsZero;
        setIncludeUnloggedNumericDaysAsZero(nextValue);
        setNumericStatsPreferenceSaving(true);
        setNumericStatsPreferenceError(null);

        try {
            await userService.updatePreferences({ includeUnloggedNumericDaysAsZero: nextValue });
            statService.clearSummaryCache();
        } catch (error) {
            console.error('Failed to update statistics preferences:', error);
            setIncludeUnloggedNumericDaysAsZero(previousValue);
            setNumericStatsPreferenceError('Could not save this preference right now.');
        } finally {
            setNumericStatsPreferenceSaving(false);
        }
    }

    function handlePomodoroSecondsModeChange(event: ChangeEvent<HTMLInputElement>) {
        const nextValue = event.target.checked;
        setPomodoroSecondsMode(nextValue);
        setPomodoroSecondsModePreference(nextValue);
    }

    function handleShowClosedMentalThreadsChange(event: ChangeEvent<HTMLInputElement>) {
        const nextValue = event.target.checked;
        setShowClosedMentalThreadsState(nextValue);
        setShowClosedMentalThreads(nextValue);
    }

    function handleSoundEffectsChange(event: ChangeEvent<HTMLInputElement>) {
        const nextValue = event.target.checked;
        setSoundEffectsEnabledState(nextValue);
        setAudioFeedbackEnabled(nextValue);
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

    async function handleCheckupEnabledChange(event: ChangeEvent<HTMLInputElement>) {
        const nextValue = event.target.checked;
        const previousValue = checkupNotificationsEnabled;
        setCheckupNotificationsEnabled(nextValue);
        setCheckupPreferenceSaving(true);
        setCheckupPreferenceError(null);

        try {
            const preferences = await userService.updatePreferences({ checkupNotificationsEnabled: nextValue });
            setCheckupNotificationsEnabled(preferences.checkupNotificationsEnabled !== false);
        } catch (error) {
            console.error('Failed to update check-up notification preference:', error);
            setCheckupNotificationsEnabled(previousValue);
            setCheckupPreferenceError('Could not save check-up settings right now.');
        } finally {
            setCheckupPreferenceSaving(false);
        }
    }

    async function handleCheckupScheduleSave() {
        const previous = { checkupIntervalMinutes, checkupStartTime, checkupTimesPerDay };
        setCheckupPreferenceSaving(true);
        setCheckupPreferenceError(null);

        try {
            const preferences = await userService.updatePreferences({
                checkupIntervalMinutes,
                checkupStartTime,
                checkupTimesPerDay,
            });
            setCheckupIntervalMinutes(preferences.checkupIntervalMinutes);
            setCheckupStartTime(preferences.checkupStartTime.slice(0, 5));
            setCheckupTimesPerDay(preferences.checkupTimesPerDay);
        } catch (error) {
            console.error('Failed to update check-up notification schedule:', error);
            setCheckupIntervalMinutes(previous.checkupIntervalMinutes);
            setCheckupStartTime(previous.checkupStartTime);
            setCheckupTimesPerDay(previous.checkupTimesPerDay);
            setCheckupPreferenceError('Could not save this check-up schedule right now.');
        } finally {
            setCheckupPreferenceSaving(false);
        }
    }

    const displayName = user ? `${user.firstName} ${user.lastName}`.trim() || user.username : 'Unknown user';
    const userInitials = user
        ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() || user.username?.[0]?.toUpperCase() || '?'
        : '?';

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
                                                Show completed tasks
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {showCompletedTasksDescription}
                                            </Typography>
                                        </Box>
                                        <Switch
                                            checked={showCompletedHomeTasks}
                                            onChange={(event) => setShowCompletedHomeTasks(event.target.checked)}
                                            inputProps={{ 'aria-label': 'Show completed tasks on the Home and Tasks pages' }}
                                        />
                                    </Box>
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
                                            inputProps={{ 'aria-label': 'Show closed mental threads' }}
                                        />
                                    </Box>
                                </Box>

                                <Box sx={sectionCardSx}>
                                    <Box sx={sectionHeadingSx}>
                                        <AccessTimeOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                            Mental state check-ups
                                        </Typography>
                                    </Box>

                                    {checkupPreferenceError && (
                                        <Alert severity="warning" sx={{ mb: 2 }}>
                                            {checkupPreferenceError}
                                        </Alert>
                                    )}
                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 2 }}>
                                        <Box sx={{ textAlign: 'left' }}>
                                            <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                                Send check-up notifications
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Get a reminder to pause and record how you are doing.
                                            </Typography>
                                        </Box>
                                        <Switch
                                            checked={checkupNotificationsEnabled}
                                            onChange={handleCheckupEnabledChange}
                                            disabled={userPreferencesLoading || checkupPreferenceSaving}
                                            inputProps={{ 'aria-label': 'Enable mental state check-up notifications' }}
                                        />
                                    </Box>

                                    {!userPreferencesLoading && checkupNotificationsEnabled && (
                                        <>
                                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                                                <TextField
                                                    select
                                                    fullWidth
                                                    size="small"
                                                    label="Repeat every"
                                                    value={checkupIntervalMinutes}
                                                    onChange={event => setCheckupIntervalMinutes(Number(event.target.value))}
                                                    disabled={checkupPreferenceSaving}
                                                >
                                                    {checkupIntervalOptions.map(option => (
                                                        <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                                                    ))}
                                                </TextField>
                                                <CheckupStartTimeField
                                                    value={checkupStartTime}
                                                    onChange={setCheckupStartTime}
                                                    disabled={checkupPreferenceSaving}
                                                />
                                                <TextField
                                                    select
                                                    fullWidth
                                                    size="small"
                                                    label="Times per day"
                                                    value={checkupTimesPerDay}
                                                    onChange={event => setCheckupTimesPerDay(Number(event.target.value))}
                                                    disabled={checkupPreferenceSaving}
                                                >
                                                    {Array.from({ length: 24 }, (_, index) => index + 1).map(value => (
                                                        <MenuItem key={value} value={value}>{value}</MenuItem>
                                                    ))}
                                                </TextField>
                                            </Stack>
                                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.25, textAlign: 'left' }}>
                                                Notifications are delivered at the start time and then at each interval, within the same day.
                                            </Typography>
                                            <Button
                                                variant="outlined"
                                                onClick={() => void handleCheckupScheduleSave()}
                                                disabled={checkupPreferenceSaving}
                                                startIcon={checkupPreferenceSaving ? <CircularProgress size={16} color="inherit" /> : undefined}
                                                sx={{ mt: 2, borderRadius: 2, textTransform: 'none' }}
                                            >
                                                {checkupPreferenceSaving ? 'Saving...' : 'Save check-up schedule'}
                                            </Button>
                                        </>
                                    )}
                                </Box>

                                <Box sx={sectionCardSx}>
                                    <Box sx={sectionHeadingSx}>
                                        <QueryStatsOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                            Statistics
                                        </Typography>
                                    </Box>

                                    {numericStatsPreferenceError && (
                                        <Alert severity="warning" sx={{ mb: 2 }}>
                                            {numericStatsPreferenceError}
                                        </Alert>
                                    )}
                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                                        <Box sx={{ textAlign: 'left' }}>
                                            <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                                Count unlogged days as zero
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {numericStatsAverageDescription}
                                            </Typography>
                                        </Box>
                                        <Switch
                                            checked={includeUnloggedNumericDaysAsZero}
                                            onChange={handleNumericStatsPreferenceChange}
                                            disabled={userPreferencesLoading || numericStatsPreferenceSaving}
                                            inputProps={{ 'aria-label': 'Count unlogged days as zero in numeric stat averages' }}
                                        />
                                    </Box>
                                </Box>

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
                                            disabled={pomodoroConfigLoading}
                                            inputProps={{ 'aria-label': 'Use short Pomodoro durations in seconds' }}
                                        />
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
                                            else setChangePasswordOpen(true);
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
                                        onClick={() => setLogoutDialogOpen(true)}
                                        sx={{ justifyContent: 'flex-start', borderRadius: 2, py: 1.1, textTransform: 'none' }}
                                    >
                                        Log out
                                    </Button>
                                </Box>
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
                </Box>
            </Box>
            <Dialog open={logoutDialogOpen} onClose={() => setLogoutDialogOpen(false)}>
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
            </Dialog>
        </PageWrapper>
    );
}

export default SettingsPage;
