import { Box, ListItemButton } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { SvgIconComponent } from '@mui/icons-material';

// Must match COLLAPSED_WIDTH in SideNav
const ICON_ZONE_WIDTH = 60;

type Props = {
    Icon: SvgIconComponent;
    text: string;
    targetPage: string;
};

export function SideMenuButton({ Icon, text, targetPage }: Props) {
    const navigate = useNavigate();
    const location = useLocation();
    const isActive = location.pathname === targetPage;

    return (
        <ListItemButton
            onClick={() => navigate(targetPage)}
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
        </ListItemButton>
    );
}
