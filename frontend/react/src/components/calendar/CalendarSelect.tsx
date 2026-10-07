import { Checkbox, Chip, ListItemIcon, Menu, MenuItem, TextField } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useState } from 'react';
import { Calendar, calendarColorHex } from '../../types/Calendar';

type Props = {
    calendars: Calendar[];
    value: string;
    onChange: (calendarId: string) => void;
    label?: string;
};

export function CalendarSelect({
    calendars,
    value,
    onChange,
    label = 'Calendar',
}: Props) {
    const theme = useTheme();

    return (
        <TextField
            select
            label={label}
            value={value}
            onChange={event => onChange(event.target.value)}
            size="small"
            fullWidth
            slotProps={{ inputLabel: { shrink: true } }}
            SelectProps={{
                displayEmpty: true,
                renderValue: selected => {
                    const selectedId = typeof selected === 'string' ? selected : '';
                    const calendar = calendars.find(item => item.id === selectedId);
                    if (selectedId && !calendar) return 'Deleted calendar · uses Default when applied';
                    return calendar?.name ?? 'Default';
                },
            }}
        >
            {value && !calendars.some(calendar => calendar.id === value) && (
                <MenuItem value={value} disabled>Deleted calendar · uses Default when applied</MenuItem>
            )}
            {calendars.map(calendar => (
                <MenuItem key={calendar.id} value={calendar.id} sx={{ pl: 1.25 }}>
                    <Checkbox
                        checked={calendar.id === value || (!value && calendar.defaultCalendar)}
                        size="small"
                        disableRipple
                        onChange={() => {}}
                        sx={{
                            p: 0,
                            mr: 0.75,
                            color: calendarColorHex(calendar.color, theme.palette.primary.main),
                            '&.Mui-checked': {
                                color: calendarColorHex(calendar.color, theme.palette.primary.main),
                            },
                        }}
                    />
                    {calendar.name}
                </MenuItem>
            ))}
        </TextField>
    );
}

type CalendarChipSelectProps = {
    calendars: Calendar[];
    value: string;
    onChange: (calendarId: string, anchorEl?: HTMLElement | null) => void;
};

export function CalendarChipSelect({ calendars, value, onChange }: CalendarChipSelectProps) {
    const theme = useTheme();
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const selectedCalendar = calendars.find(calendar => calendar.id === value)
        ?? calendars.find(calendar => calendar.defaultCalendar);
    const label = selectedCalendar?.name ?? (value ? 'Deleted calendar' : 'Default');
    const color = calendarColorHex(selectedCalendar?.color, theme.palette.primary.main);

    return (
        <>
            <Chip
                size="medium"
                label={label}
                onClick={event => setAnchorEl(event.currentTarget)}
                aria-label={`Change calendar, currently ${label}`}
                sx={theme => ({
                    height: 30,
                    borderRadius: '8px',
                    color,
                    bgcolor: alpha(color, theme.palette.mode === 'dark' ? 0.18 : 0.08),
                    border: '1px solid',
                    borderColor: color,
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    '& .MuiChip-label': { px: 1.25, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' },
                    '&:hover': { bgcolor: alpha(color, 0.2) },
                })}
            />
            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={() => setAnchorEl(null)}
                MenuListProps={{ disablePadding: true }}
                slotProps={{ paper: { sx: { borderRadius: '8px' } } }}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
                {calendars.map(calendar => {
                    const optionColor = calendarColorHex(calendar.color, theme.palette.primary.main);
                    const selected = calendar.id === value || (!value && calendar.defaultCalendar);
                    return (
                        <MenuItem
                            key={calendar.id}
                            selected={selected}
                            sx={{ pl: 1.25 }}
                            onClick={() => {
                                onChange(calendar.id, anchorEl);
                                setAnchorEl(null);
                            }}
                        >
                            <ListItemIcon sx={{ minWidth: 24 }}>
                                <Checkbox
                                    size="small"
                                    checked={selected}
                                    disableRipple
                                    onChange={() => {}}
                                    sx={{
                                        p: 0,
                                        color: optionColor,
                                        '&.Mui-checked': { color: optionColor },
                                    }}
                                />
                            </ListItemIcon>
                            {calendar.name}
                        </MenuItem>
                    );
                })}
            </Menu>
        </>
    );
}
