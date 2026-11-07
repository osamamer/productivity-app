import {
    Box, Button, Slider, Stack, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import { AppNumberField } from '../input/AppNumberField';
import { AppTimeField } from '../input/AppPickerFields';
import { minutesToTimeValue, timeValueToMinutes } from '../../services/utils/statValues';
import { StatDefinition, StatEntryStatus, StatType } from '../../types/Stats';
import { DurationInput } from './DurationInput';
import { getBooleanChoiceColor, getBooleanChoiceTextColor } from '../../services/statFeedback';

interface Props {
    definition: StatDefinition;
    type: StatType;
    value: number | null;
    status?: StatEntryStatus;
    primary?: boolean;
    onChange: (value: number | null, status?: StatEntryStatus) => void;
    onFocus: (element: HTMLElement) => void;
}

export function StatInputField({
    definition,
    type,
    value,
    status = 'RECORDED',
    primary = false,
    onChange,
    onFocus,
}: Props) {
    if (type === 'BOOLEAN') {
        const selectedValue = primary && status === 'NOT_PLANNED'
            ? 'not-planned'
            : value === 1 ? 'yes' : value === 0 ? 'no' : null;
        return (
            <ToggleButtonGroup
                value={selectedValue}
                exclusive
                onChange={(_, selected: string | null) => onChange(
                    selected === null ? null : selected === 'yes' ? 1 : 0,
                    selected === 'not-planned' ? 'NOT_PLANNED' : 'RECORDED',
                )}
                size="small"
            >
                <ToggleButton
                    value="yes"
                    onClick={event => onFocus(event.currentTarget)}
                    sx={primary ? {
                        '&.Mui-selected': {
                            bgcolor: `${getBooleanChoiceColor(definition, 1)}.main`,
                            color: getBooleanChoiceTextColor(definition, 1),
                            '&:hover': { bgcolor: `${getBooleanChoiceColor(definition, 1)}.dark` },
                        },
                    } : undefined}
                >
                    Yes
                </ToggleButton>
                {primary && (
                    <ToggleButton
                        value="not-planned"
                        sx={{
                            '&.Mui-selected': {
                                bgcolor: 'notPlanned.main',
                                color: 'notPlanned.contrastText',
                                '&:hover': { bgcolor: 'notPlanned.dark' },
                            },
                        }}
                    >
                        Not planned
                    </ToggleButton>
                )}
                <ToggleButton
                    value="no"
                    onClick={event => onFocus(event.currentTarget)}
                    sx={primary ? {
                        '&.Mui-selected': {
                            bgcolor: `${getBooleanChoiceColor(definition, 0)}.main`,
                            color: getBooleanChoiceTextColor(definition, 0),
                            '&:hover': { bgcolor: `${getBooleanChoiceColor(definition, 0)}.dark` },
                        },
                    } : undefined}
                >
                    No
                </ToggleButton>
            </ToggleButtonGroup>
        );
    }

    if (type === 'NUMBER') {
        return (
            <Stack direction="row" spacing={1} alignItems="center">
                <AppNumberField
                    autoComplete="off"
                    size="small"
                    value={value ?? ''}
                    onChange={event => onChange(event.target.value === '' ? null : Number(event.target.value))}
                    onStepValueChange={onChange}
                    onFocus={event => onFocus(event.currentTarget)}
                    inputProps={{ 'aria-label': primary ? definition.name : 'Amount' }}
                    sx={{ width: 160 }}
                />
                {definition.unit && (
                    <Typography variant="body2" color="text.secondary">{definition.unit}</Typography>
                )}
            </Stack>
        );
    }

    if (type === 'TIME') {
        return (
            <AppTimeField
                label={primary ? definition.name : 'Time'}
                size="small"
                value={minutesToTimeValue(value)}
                onChange={next => onChange(next ? timeValueToMinutes(next) : null)}
                onFocus={event => onFocus(event.currentTarget)}
                minutesStep={1}
                inputProps={{ 'aria-label': primary ? `${definition.name} time` : 'Time' }}
                sx={{ width: 160 }}
            />
        );
    }

    if (type === 'DURATION') {
        return (
            <DurationInput
                value={value}
                onChange={onChange}
                onFocus={event => onFocus(event.currentTarget)}
            />
        );
    }

    const minValue = primary ? definition.minValue ?? 0 : 0;
    const maxValue = primary ? definition.maxValue ?? 10 : 10;
    return (
        <Box sx={{ px: 1, width: 300, maxWidth: '100%' }}>
            <Slider
                value={value ?? minValue}
                min={minValue}
                max={maxValue}
                step={1}
                marks
                valueLabelDisplay="auto"
                color={primary && value == null ? 'secondary' : 'primary'}
                onChange={(event, next) => {
                    onFocus(event.currentTarget as HTMLElement);
                    onChange(next as number);
                }}
            />
            <Stack direction="row" justifyContent="space-between">
                <Typography variant="caption" color="text.secondary">{minValue}</Typography>
                <Typography variant="caption" color="text.secondary">{maxValue}</Typography>
            </Stack>
            {value == null
                ? <Typography variant="caption" color="text.secondary">Move the slider to record a value</Typography>
                : <Button size="small" onClick={() => onChange(null)}>Clear</Button>}
        </Box>
    );
}
