import { FormControlLabel, Stack, Switch, Typography } from '@mui/material';
import { UsageSettings } from '../../services/desktop';

interface ScreenTimeTogglesProps {
    settings: UsageSettings;
    onChange: (settings: UsageSettings) => void;
    disabled?: boolean;
    showEnabled?: boolean;
}

function Toggle({ checked, onChange, label, help, disabled }: { checked: boolean; onChange: (checked: boolean) => void; label: string; help: string; disabled?: boolean }) {
    return (
        <FormControlLabel
            disabled={disabled}
            control={<Switch checked={checked} onChange={event => onChange(event.target.checked)} />}
            sx={{ alignItems: 'flex-start', m: 0, gap: 1 }}
            label={(
                <Stack sx={{ pt: 0.75, textAlign: 'left' }}>
                    <Typography variant="body2">{label}</Typography>
                    <Typography variant="caption" color="text.secondary">{help}</Typography>
                </Stack>
            )}
        />
    );
}

/** The screen-time switches, shared by the Day page's setup card and Settings. */
export function ScreenTimeToggles({ settings, onChange, disabled, showEnabled = false }: ScreenTimeTogglesProps) {
    return (
        <Stack spacing={1}>
            {showEnabled && (
                <Toggle
                    checked={settings.enabled}
                    onChange={enabled => onChange({ ...settings, enabled })}
                    label="Record screen time"
                    help="Which app is in focus, minus the time you're away from the computer."
                    disabled={disabled}
                />
            )}
            <Toggle
                checked={settings.recordTitles}
                onChange={recordTitles => onChange({ ...settings, recordTitles })}
                label="Remember window titles"
                help="Shown when you hover a block, so you can tell the thesis from the rabbit hole."
                disabled={disabled}
            />
            <Toggle
                checked={settings.startAtLogin}
                onChange={startAtLogin => onChange({ ...settings, startAtLogin })}
                label="Start at login, in the tray"
                help="Otherwise, time before you open Claritard shows as not tracked."
                disabled={disabled}
            />
        </Stack>
    );
}
