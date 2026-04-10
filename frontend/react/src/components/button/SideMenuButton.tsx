import { Box, ListItemButton, ListItemText, Tooltip } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { SvgIconComponent } from '@mui/icons-material';

// Must match COLLAPSED_WIDTH in SideNav
const ICON_ZONE_WIDTH = 64;

type Props = {
    Icon: SvgIconComponent;
    text: string;
    targetPage: string;
    open: boolean;
};

export function SideMenuButton({ Icon, text, targetPage, open }: Props) {
    const navigate = useNavigate();
    const location = useLocation();
    const isActive = location.pathname === targetPage;

    return (
        <Tooltip title={open ? '' : text} placement="right">
            <ListItemButton
                onClick={() => navigate(targetPage)}
                selected={isActive}
                sx={{
                    height: 56,
                    borderBottom: 0.5,
                    alignItems: 'center',
                    px: 0,
                }}
            >
                {/* Fixed-width icon zone — icon never moves regardless of open state */}
                <Box sx={{
                    width: ICON_ZONE_WIDTH,
                    flexShrink: 0,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    color: isActive ? 'primary.main' : 'inherit',
                }}>
                    <Icon />
                </Box>
                <ListItemText
                    primary={text}
                    sx={{
                        opacity: open ? 1 : 0,
                        transition: 'opacity 0.2s ease',
                        color: isActive ? 'primary.main' : 'inherit',
                        whiteSpace: 'nowrap',
                    }}
                />
            </ListItemButton>
        </Tooltip>
    );
}
