import { Box, ButtonBase, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import WorkOutlineRoundedIcon from '@mui/icons-material/WorkOutlineRounded';
import SpaOutlinedIcon from '@mui/icons-material/SpaOutlined';
import { HomeMode } from './homeMode';

const OPTIONS = [
    { mode: 'labor', label: 'Labor', Icon: WorkOutlineRoundedIcon },
    { mode: 'leisure', label: 'Leisure', Icon: SpaOutlinedIcon },
] as const;

/** Two labelled icons that float at the top right of Home and switch between labor and leisure. */
export function HomeModeSwitch({ mode, onChange }: { mode: HomeMode; onChange: (mode: HomeMode) => void }) {
    return (
        // Zero height and sticky: it floats over the page while scrolling without pushing content down.
        <Box sx={{ position: 'sticky', top: 0, height: 0, zIndex: 5, display: 'flex', justifyContent: 'flex-end', overflow: 'visible' }}>
            <Box
                role="radiogroup"
                aria-label="Home mode"
                onClick={event => event.stopPropagation()}
                sx={{
                    display: 'flex',
                    gap: 0.25,
                    p: 0.5,
                    mt: 1,
                    mr: { xs: 0.5, sm: 1 },
                    height: 'fit-content',
                    borderRadius: 3,
                    border: 1,
                    borderColor: 'divider',
                    backgroundColor: 'background.paper',
                    boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
                }}
            >
                {OPTIONS.map(({ mode: option, label, Icon }) => {
                    const selected = option === mode;
                    return (
                        <ButtonBase
                            key={option}
                            role="radio"
                            aria-checked={selected}
                            onClick={() => onChange(option)}
                            sx={theme => ({
                                flexDirection: 'column',
                                gap: 0.25,
                                width: 56,
                                py: 0.75,
                                borderRadius: 2.5,
                                color: selected ? 'primary.main' : 'text.secondary',
                                backgroundColor: selected ? alpha(theme.palette.primary.main, 0.1) : 'transparent',
                                transition: 'background-color 160ms ease, color 160ms ease',
                                '&:hover': {
                                    backgroundColor: selected
                                        ? alpha(theme.palette.primary.main, 0.14)
                                        : alpha(theme.palette.primary.main, 0.05),
                                },
                            })}
                        >
                            <Icon sx={{ fontSize: 20 }} />
                            <Typography component="span" sx={{ fontSize: '0.68rem', fontWeight: selected ? 700 : 500, lineHeight: 1 }}>
                                {label}
                            </Typography>
                        </ButtonBase>
                    );
                })}
            </Box>
        </Box>
    );
}
