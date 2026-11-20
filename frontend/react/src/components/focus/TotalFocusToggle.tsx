import { ButtonBase, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import CenterFocusStrongRoundedIcon from '@mui/icons-material/CenterFocusStrongRounded';

/** Floats beside the Home mode switch while a pomodoro runs; switches total focus on and off. */
export function TotalFocusToggle({ active, onChange }: { active: boolean; onChange: (active: boolean) => void }) {
    return (
        <ButtonBase
            aria-pressed={active}
            aria-label={active ? 'Leave total focus' : 'Total focus'}
            title={active ? 'Leave total focus' : 'Total focus: hide everything but the timer'}
            onClick={event => {
                event.stopPropagation();
                onChange(!active);
            }}
            sx={theme => ({
                flexDirection: 'column',
                gap: 0.25,
                width: 56,
                py: 0.75,
                borderRadius: 2.5,
                color: active ? 'primary.main' : 'text.secondary',
                backgroundColor: active ? alpha(theme.palette.primary.main, 0.1) : 'transparent',
                transition: 'background-color 160ms ease, color 160ms ease',
                '&:hover': { backgroundColor: alpha(theme.palette.primary.main, active ? 0.14 : 0.05) },
            })}
        >
            <CenterFocusStrongRoundedIcon sx={{ fontSize: 20 }} />
            <Typography component="span" sx={{ fontSize: '0.68rem', fontWeight: active ? 700 : 500, lineHeight: 1 }}>
                Focus
            </Typography>
        </ButtonBase>
    );
}
