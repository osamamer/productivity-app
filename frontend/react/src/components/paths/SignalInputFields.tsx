import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { Box, IconButton, MenuItem, TextField, ToggleButton, ToggleButtonGroup, Tooltip } from '@mui/material';
import type { StatDefinition } from '../../types/Stats';
import type { InputDirection, InputScoring } from '../../types/Path';
import { SCORING_OPTIONS, valueTypeOf, withStat, type InputForm, type StatOption } from './pathDraft';

interface Props {
    input: InputForm;
    options: StatOption[];
    showWeight: boolean;
    onChange: (input: InputForm) => void;
    onRemove: () => void;
}

const SOURCE_LABELS: Record<string, string> = { DURATION: 'Duration', NUMBER: 'Number', TIME: 'Time', RANGE: 'Range', BOOLEAN: 'Yes/no' };

function targetLabel(scoring: InputScoring, definition: StatDefinition | undefined, valueSource: string): string {
    if (scoring === 'TIMES') return 'Target (times a week)';
    const valueType = valueTypeOf(definition, valueSource);
    const unit = valueType === 'DURATION' ? 'hours' : definition?.unit;
    const per = scoring === 'TOTAL' ? 'a week' : 'a day';
    return unit ? `Target (${unit} ${per})` : `Target ${per}`;
}

/** One stat feeding the signal and what doing well means for it. */
export function SignalInputFields({ input, options, showWeight, onChange, onRemove }: Props) {
    const definition = options.find(option => option.definition.id === input.statDefinitionId)?.definition;
    const sources = definition?.additionalInputTypes ?? [];
    return (
        <Box sx={{ display: 'grid', gap: 1.25, p: 1.5, border: 1, borderColor: 'divider', borderRadius: 2 }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <TextField select size="small" label="Stat" value={definition ? input.statDefinitionId : ''} sx={{ flex: 1 }}
                           onChange={event => {
                               const next = options.find(option => option.definition.id === event.target.value)?.definition;
                               if (next) onChange(withStat(input, next));
                           }}>
                    {options.map(option => <MenuItem key={option.definition.id} value={option.definition.id}>{option.label}</MenuItem>)}
                </TextField>
                {sources.length > 0 && (
                    <TextField select size="small" label="Measure" value={input.valueSource} sx={{ width: 130 }}
                               onChange={event => onChange({ ...input, valueSource: event.target.value })}>
                        <MenuItem value="VALUE">{SOURCE_LABELS[definition?.type ?? ''] ?? 'Value'}</MenuItem>
                        {sources.map(source => <MenuItem key={source} value={source}>{SOURCE_LABELS[source] ?? source}</MenuItem>)}
                    </TextField>
                )}
                <Tooltip title="Remove input">
                    <IconButton size="small" aria-label="Remove input" onClick={onRemove}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton>
                </Tooltip>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                <TextField select size="small" label="Score each week by" value={input.scoring} sx={{ flex: '1 1 210px' }}
                           helperText={SCORING_OPTIONS.find(option => option.value === input.scoring)?.help}
                           onChange={event => onChange({ ...input, scoring: event.target.value as InputScoring })}>
                    {SCORING_OPTIONS.map(option => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
                </TextField>
                <TextField size="small" label={targetLabel(input.scoring, definition, input.valueSource)} value={input.target}
                           inputProps={{ inputMode: 'decimal' }} sx={{ flex: '1 1 150px' }}
                           onChange={event => onChange({ ...input, target: event.target.value })} />
                {showWeight && (
                    <TextField size="small" label="Weight" value={input.weight} inputProps={{ inputMode: 'decimal' }} sx={{ width: 90 }}
                               onChange={event => onChange({ ...input, weight: event.target.value })} />
                )}
            </Box>
            <ToggleButtonGroup size="small" exclusive value={input.direction} aria-label="Doing well means"
                               onChange={(_, direction: InputDirection | null) => direction && onChange({ ...input, direction })}
                               sx={{ '& .MuiToggleButton-root': { textTransform: 'none', py: 0.25, px: 1.25, fontSize: '0.75rem' } }}>
                <ToggleButton value="MORE_IS_BETTER">More is better</ToggleButton>
                <ToggleButton value="LESS_IS_BETTER">Less is better</ToggleButton>
            </ToggleButtonGroup>
        </Box>
    );
}
