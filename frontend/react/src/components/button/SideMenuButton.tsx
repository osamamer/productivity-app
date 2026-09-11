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
    onNavigate?: (targetPage: string) => void;
};

export function SideMenuButton({
    Icon,
    text,
    targetPage,
    activePaths = [targetPage],
    expanded = false,
    onNavigate,
}: Props) {
    const navigate = useNavigate();
    const location = useLocation();
    const isActive = activePaths.includes(location.pathname);

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
            title={text}
            aria-label={text}
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
                '& svg': {
                    transition: 'transform 0.16s ease',
                },
                '.MuiListItemButton-root:hover & svg': {
                    transform: 'scale(1.08)',
                },
            }}>
                <Icon sx={{ fontSize: 20 }} />
            </Box>
            <Typography
                noWrap
                variant="body2"
                sx={{
                    minWidth: 0,
                    flex: 1,
                    textAlign: 'left',
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? 'primary.main' : 'text.primary',
                    opacity: expanded ? 1 : 0,
                    visibility: expanded ? 'visible' : 'hidden',
                    transition: 'opacity 0.18s ease',
                }}
            >
                {text}
            </Typography>
        </ListItemButton>
    );
}
