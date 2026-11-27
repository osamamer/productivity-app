import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { Box, Button, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import type { PathEdges, PathRoad, PathShape, PathSort, PathView } from '../../types/Path';
import { currentWeek, onPaceCount } from './pathsSummary';
import { REINFORCE_GOOD, reinforcementColor } from './roadStyle';

interface Props {
    roads: PathRoad[];
    view: PathView;
    onViewChange: (change: Partial<PathView>) => void;
    onCreate: () => void;
}

function Switch<T extends string>({ label, value, options, onChange }: {
    label: string;
    value: T;
    options: [T, string][];
    onChange: (value: T) => void;
}) {
    return (
        <ToggleButtonGroup size="small" exclusive value={value} aria-label={label}
                           onChange={(_, next: T | null) => next && onChange(next)}
                           sx={{ '& .MuiToggleButton-root': { textTransform: 'none', fontWeight: 600, fontSize: '0.75rem', py: 0.375, px: 1.25 } }}>
            {options.map(([option, text]) => <ToggleButton key={option} value={option}>{text}</ToggleButton>)}
        </ToggleButtonGroup>
    );
}

/** "This week, N of M paths are on pace", a dot per path, and the page switches. */
export function PathsHeader({ roads, view, onViewChange, onCreate }: Props) {
    const { onPace, active } = onPaceCount(roads);
    return (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: '12px 24px', mb: 1.75 }}>
            <Box sx={{ minWidth: 0 }}>
                <Typography variant="h4" fontWeight={750} sx={{ letterSpacing: '-0.03em' }}>Paths</Typography>
                {roads.length > 0 && (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 22px', mt: 0.5 }}>
                        <Typography component="span" sx={{ fontSize: '1.05rem', fontWeight: 700 }}>
                            This week, <Box component="span" sx={{ color: REINFORCE_GOOD }}>{onPace} of {active} paths</Box> {active === 1 ? 'is' : 'are'} on pace.
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '8px 18px' }}>
                            {roads.map(road => {
                                const color = reinforcementColor(currentWeek(road)?.strength ?? 0);
                                return (
                                    <Box key={road.path.id} component="span" sx={{
                                        display: 'inline-flex', alignItems: 'center', gap: 0.75, fontSize: '0.8125rem', color: 'text.secondary',
                                        opacity: road.path.paused ? 0.5 : 1,
                                    }}>
                                        <Box component="i" sx={{
                                            width: 10, height: 10, borderRadius: '50%', bgcolor: color ?? 'divider',
                                            boxShadow: color ? `0 0 0 3px ${color}38` : 'none',
                                        }} />
                                        {road.path.name}
                                    </Box>
                                );
                            })}
                        </Box>
                    </Box>
                )}
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                <Switch<PathSort> label="Sort paths" value={view.sort} onChange={sort => onViewChange({ sort })}
                                  options={[['ATTENTION', 'Needs attention'], ['STRONGEST', 'Strongest'], ['CUSTOM', 'My order']]} />
                <Switch<PathEdges> label="Road edges" value={view.edges} onChange={edges => onViewChange({ edges })}
                                   options={[['FOLLOW_WEEKS', 'Edges follow weeks'], ['CONSTANT', 'Edges constant']]} />
                <Switch<PathShape> label="Road shape" value={view.shape} onChange={shape => onViewChange({ shape })}
                                   options={[['CURVED', 'Curved'], ['STRAIGHT', 'Straight']]} />
                <Button variant="contained" size="small" startIcon={<AddRoundedIcon />} onClick={onCreate} sx={{ textTransform: 'none', fontWeight: 700 }}>
                    New path
                </Button>
            </Box>
        </Box>
    );
}
