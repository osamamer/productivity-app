import { ListItemButton, ListItemIcon, ListItemText, Tooltip } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { SvgIconComponent } from '@mui/icons-material';

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
                    minHeight: 48,
                    justifyContent: open ? 'initial' : 'center',
                    borderBottom: 0.5,
                    py: 2,
                    alignItems: 'center',
                }}
            >
                <ListItemIcon
                    sx={{
                        minWidth: 0,
                        mr: open ? 3 : 0,
                        justifyContent: 'center',
                        color: isActive ? 'primary.main' : 'inherit',
                    }}
                >
                    <Icon />
                </ListItemIcon>
                {open && (
                    <ListItemText
                        primary={text}
                        sx={{ color: isActive ? 'primary.main' : 'inherit' }}
                    />
                )}
            </ListItemButton>
        </Tooltip>
    );
}
