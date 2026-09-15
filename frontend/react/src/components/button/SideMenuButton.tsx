import { Box, ListItemButton, Typography } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { SvgIconComponent } from '@mui/icons-material';
import { preloadPrimaryRoute } from '../../services/routePreload';

// Must match COLLAPSED_WIDTH in SideNav
const ICON_ZONE_WIDTH = 60;

type Props = {
    Icon: SvgIconComponent;
    text: string;
    targetPage: string;
    activePaths?: string[];
    expanded?: boolean;
    activeIndicator?: {
        color: string;
        label: string;
    };
    onNavigate?: (targetPage: string) => void;
};

export function SideMenuButton({
    Icon,
    text,
    targetPage,
    activePaths = [targetPage],
    expanded = false,
    activeIndicator,
    onNavigate,
}: Props) {
    const navigate = useNavigate();
    const location = useLocation();
    const isActive = activePaths.includes(location.pathname);
    const accessibleLabel = activeIndicator ? `${text} · Pomodoro ${activeIndicator.label.toLowerCase()}` : text;

    return (
        <ListItemButton
            selected={isActive}
            onPointerEnter={() => preloadPrimaryRoute(targetPage)}
            onFocus={() => preloadPrimaryRoute(targetPage)}
            onClick={() => {
                if (onNavigate) {
                    onNavigate(targetPage);
                } else {
                    navigate(targetPage);
                }
            }}
            title={accessibleLabel}
            aria-label={accessibleLabel}
            sx={{
                minHeight: 46,
                alignItems: 'center',
                px: 0,
                py: 0.25,
                '&:hover': {
                    backgroundColor: 'transparent',
                },
                '&.Mui-selected': {
                    backgroundColor: 'action.hover',
                },
                '&.Mui-selected:hover': {
                    backgroundColor: 'action.hover',
                },
            }}
        >
            <Box sx={{
                width: ICON_ZONE_WIDTH,
                flexShrink: 0,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                color: isActive ? 'primary.main' : 'inherit',
                position: 'relative',
                '& svg': {
                    transition: 'transform 0.16s ease',
                },
                '.MuiListItemButton-root:hover & svg': {
                    transform: 'scale(1.08)',
                },
            }}>
                <Icon sx={{ fontSize: 20 }} />
                {activeIndicator && (
                    <Box
                        aria-hidden="true"
                        sx={{
                            position: 'absolute',
                            top: 8,
                            right: 14,
                            width: 7,
                            height: 7,
                            borderRadius: '50%',
                            backgroundColor: activeIndicator.color,
                            boxShadow: theme => `0 0 0 2px ${theme.palette.background.paper}`,
                        }}
                    />
                )}
            </Box>
            <Box sx={{
                minWidth: 0,
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                opacity: expanded ? 1 : 0,
                visibility: expanded ? 'visible' : 'hidden',
                transition: 'opacity 0.18s ease',
            }}>
                <Typography
                    noWrap
                    variant="body2"
                    sx={{
                        minWidth: 0,
                        flex: 1,
                        textAlign: 'left',
                        fontWeight: isActive ? 600 : 400,
                        color: isActive ? 'primary.main' : 'text.primary',
                    }}
                >
                    {text}
                </Typography>
                {activeIndicator && (
                    <Typography variant="caption" sx={{ color: activeIndicator.color, mr: 1.5, fontWeight: 600 }}>
                        {activeIndicator.label}
                    </Typography>
                )}
            </Box>
        </ListItemButton>
    );
}
