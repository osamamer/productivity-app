import { ChangeEvent, memo, useCallback, useEffect, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    MenuItem,
    Snackbar,
    Stack,
    Switch,
    TextField,
    Typography,
} from '@mui/material';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import { userService } from '../../services/api/userService.ts';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';

import { sectionCardSx, sectionHeadingSx } from './settingsStyles';
import {
    DEFAULT_CHECKUP_INTERVAL_MINUTES,
    DEFAULT_CHECKUP_START_TIME,
    checkupIntervalOptions,
    checkupTimesPerDay,
    dateFromTime,
    repeatCheckupNotificationsDescription,
    timeFromDate,
} from './checkupSchedule';

const CheckupStartTimeField = memo(function CheckupStartTimeField({ value, disabled, onChange }: { value: string; disabled: boolean; onChange: (value: string) => void }) {
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
});

interface CheckupToggleRowProps {
    label: string;
    description: string;
    checked: boolean;
    disabled: boolean;
    ariaLabel: string;
    onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

const CheckupToggleRow = memo(function CheckupToggleRow({
    label,
    description,
    checked,
    disabled,
    ariaLabel,
    onChange,
}: CheckupToggleRowProps) {
    return (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 2 }}>
            <Box sx={{ textAlign: 'left' }}>
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {label}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    {description}
                </Typography>
            </Box>
            <Switch
                checked={checked}
                onChange={onChange}
                disabled={disabled}
                inputProps={{ 'aria-label': ariaLabel }}
            />
        </Box>
    );
});

interface CheckupSelectFieldProps {
    label: string;
    value: number;
    options: ReadonlyArray<{ value: number; label: string }>;
    disabled: boolean;
    onChange: (value: number) => void;
}

const CheckupSelectField = memo(function CheckupSelectField({
    label,
    value,
    options,
    disabled,
    onChange,
}: CheckupSelectFieldProps) {
    return (
        <TextField
            select
            fullWidth
            size="small"
            label={label}
            value={value}
            onChange={event => onChange(Number(event.target.value))}
            disabled={disabled}
        >
            {options.map(option => (
                <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
            ))}
        </TextField>
    );
});

interface CheckupScheduleProps {
    intervalMinutes: number;
    startTime: string;
    disabled: boolean;
    saving: boolean;
    onIntervalChange: (value: number) => void;
    onStartTimeChange: (value: string) => void;
    onSave: () => void;
}

const CheckupSchedule = memo(function CheckupSchedule({
    intervalMinutes,
    startTime,
    disabled,
    saving,
    onIntervalChange,
    onStartTimeChange,
    onSave,
}: CheckupScheduleProps) {
    return (
        <>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <CheckupSelectField
                    label="Repeat every"
                    value={intervalMinutes}
                    options={checkupIntervalOptions}
                    onChange={onIntervalChange}
                    disabled={disabled}
                />
                <CheckupStartTimeField
                    value={startTime}
                    onChange={onStartTimeChange}
                    disabled={disabled}
                />
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.25, textAlign: 'left' }}>
                Notifications start at this time and repeat at this interval until the daily schedule ends.
            </Typography>
            <Button
                variant="outlined"
                onClick={onSave}
                disabled={disabled}
                startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
                sx={{ mt: 2, borderRadius: 2, textTransform: 'none' }}
            >
                {saving ? 'Saving...' : 'Save check-up schedule'}
            </Button>
        </>
    );
});

export const CheckupSettingsSection = memo(function CheckupSettingsSection() {
    const [checkupNotificationsEnabled, setCheckupNotificationsEnabled] = useState(true);
    const [repeatCheckupNotificationsEnabled, setRepeatCheckupNotificationsEnabled] = useState(true);
    const [checkupIntervalMinutes, setCheckupIntervalMinutes] = useState(DEFAULT_CHECKUP_INTERVAL_MINUTES);
    const [checkupStartTime, setCheckupStartTime] = useState(DEFAULT_CHECKUP_START_TIME);
    const [checkupPreferencesLoading, setCheckupPreferencesLoading] = useState(true);
    const [checkupEnabledSaving, setCheckupEnabledSaving] = useState(false);
    const [repeatCheckupSaving, setRepeatCheckupSaving] = useState(false);
    const [checkupScheduleSaving, setCheckupScheduleSaving] = useState(false);
    const [checkupPreferenceError, setCheckupPreferenceError] = useState<string | null>(null);
    const [checkupPreferenceSuccess, setCheckupPreferenceSuccess] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        userService.getPreferences()
            .then(preferences => {
                if (!cancelled) {
                    setCheckupNotificationsEnabled(preferences.checkupNotificationsEnabled !== false);
                    setRepeatCheckupNotificationsEnabled(preferences.repeatCheckupNotificationsEnabled !== false);
                    setCheckupIntervalMinutes(preferences.checkupIntervalMinutes || DEFAULT_CHECKUP_INTERVAL_MINUTES);
                    setCheckupStartTime(preferences.checkupStartTime?.slice(0, 5) || DEFAULT_CHECKUP_START_TIME);
                    const checkupTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
                    if (preferences.checkupTimeZone !== checkupTimeZone) {
                        void userService.updatePreferences({ checkupTimeZone }).catch(error => {
                            console.error('Could not synchronize the check-up time zone:', error);
                        });
                    }
                }
            })
            .catch(error => {
                console.error('Failed to load check-up settings:', error);
                if (!cancelled) setCheckupPreferenceError('Could not load check-up settings right now.');
            })
            .finally(() => {
                if (!cancelled) setCheckupPreferencesLoading(false);
            });
        return () => { cancelled = true; };
    }, []);

    const handleCheckupEnabledChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
        const nextValue = event.target.checked;
        const previousValue = checkupNotificationsEnabled;
        setCheckupNotificationsEnabled(nextValue);
        setCheckupEnabledSaving(true);
        setCheckupPreferenceError(null);
        setCheckupPreferenceSuccess(null);

        try {
            const preferences = await userService.updatePreferences({ checkupNotificationsEnabled: nextValue });
            setCheckupNotificationsEnabled(preferences.checkupNotificationsEnabled !== false);
            setCheckupPreferenceSuccess('Check-up notifications saved.');
        } catch (error) {
            console.error('Failed to update check-up notification preference:', error);
            setCheckupNotificationsEnabled(previousValue);
            setCheckupPreferenceError('Could not save check-up settings right now.');
        } finally {
            setCheckupEnabledSaving(false);
        }
    }, [checkupNotificationsEnabled]);

    const handleCheckupRepeatEnabledChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
        const nextValue = event.target.checked;
        const previousValue = repeatCheckupNotificationsEnabled;
        setRepeatCheckupNotificationsEnabled(nextValue);
        setRepeatCheckupSaving(true);
        setCheckupPreferenceError(null);
        setCheckupPreferenceSuccess(null);

        try {
            const preferences = await userService.updatePreferences({
                repeatCheckupNotificationsEnabled: nextValue,
            });
            setRepeatCheckupNotificationsEnabled(preferences.repeatCheckupNotificationsEnabled !== false);
            setCheckupPreferenceSuccess('Repeat reminder setting saved.');
        } catch (error) {
            console.error('Failed to update repeated check-up notification preference:', error);
            setRepeatCheckupNotificationsEnabled(previousValue);
            setCheckupPreferenceError('Could not save check-up settings right now.');
        } finally {
            setRepeatCheckupSaving(false);
        }
    }, [repeatCheckupNotificationsEnabled]);

    const handleCheckupScheduleSave = useCallback(async () => {
        const previous = { checkupIntervalMinutes, checkupStartTime };
        setCheckupScheduleSaving(true);
        setCheckupPreferenceError(null);
        setCheckupPreferenceSuccess(null);

        try {
            const preferences = await userService.updatePreferences({
                checkupIntervalMinutes,
                checkupStartTime,
                checkupTimesPerDay: checkupTimesPerDay(checkupIntervalMinutes, checkupStartTime),
                checkupTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
            });
            setCheckupIntervalMinutes(preferences.checkupIntervalMinutes);
            setCheckupStartTime(preferences.checkupStartTime.slice(0, 5));
            setCheckupPreferenceSuccess('Check-up schedule saved.');
        } catch (error) {
            console.error('Failed to update check-up notification schedule:', error);
            setCheckupIntervalMinutes(previous.checkupIntervalMinutes);
            setCheckupStartTime(previous.checkupStartTime);
            setCheckupPreferenceError('Could not save this check-up schedule right now.');
        } finally {
            setCheckupScheduleSaving(false);
        }
    }, [checkupIntervalMinutes, checkupStartTime]);

    const handleIntervalChange = useCallback((value: number) => setCheckupIntervalMinutes(value), []);
    const handleStartTimeChange = useCallback((value: string) => setCheckupStartTime(value), []);
    const handleScheduleSave = useCallback(() => {
        void handleCheckupScheduleSave();
    }, [handleCheckupScheduleSave]);

    const closeCheckupPreferenceSuccess = useCallback(() => setCheckupPreferenceSuccess(null), []);

    return (
        <>
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
                <CheckupToggleRow
                    label="Send check-up notifications"
                    description="Get a reminder to pause and record how you are doing."
                    checked={checkupNotificationsEnabled}
                    onChange={handleCheckupEnabledChange}
                    disabled={checkupPreferencesLoading || checkupEnabledSaving}
                    ariaLabel="Enable mental state check-up notifications"
                />

                {!checkupPreferencesLoading && checkupNotificationsEnabled && (
                    <>
                        <CheckupToggleRow
                            label="Keep reminding me until I check in"
                            description={repeatCheckupNotificationsDescription}
                            checked={repeatCheckupNotificationsEnabled}
                            onChange={handleCheckupRepeatEnabledChange}
                            disabled={repeatCheckupSaving}
                            ariaLabel="Repeat mental state check-up notifications until checked in"
                        />
                        <CheckupSchedule
                            intervalMinutes={checkupIntervalMinutes}
                            startTime={checkupStartTime}
                            onIntervalChange={handleIntervalChange}
                            onStartTimeChange={handleStartTimeChange}
                            onSave={handleScheduleSave}
                            disabled={checkupScheduleSaving}
                            saving={checkupScheduleSaving}
                        />
                    </>
                )}
            </Box>
            <Snackbar
                key={checkupPreferenceSuccess ?? undefined}
                open={Boolean(checkupPreferenceSuccess)}
                autoHideDuration={3500}
                onClose={closeCheckupPreferenceSuccess}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
                <Alert severity="success" variant="filled" onClose={closeCheckupPreferenceSuccess}>
                    {checkupPreferenceSuccess}
                </Alert>
            </Snackbar>
        </>
    );
});
