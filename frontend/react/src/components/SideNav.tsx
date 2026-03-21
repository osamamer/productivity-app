import {
    Avatar,
    Box,
    Divider,
    Drawer,
    IconButton,
    List,
    Tooltip,
    Typography,
} from "@mui/material";
import { useState } from "react";
import home from '../assets/images/home.png';
import clipboard from '../assets/images/clipboard.png';
import calender from '../assets/images/calendar.png';
import meditation from '../assets/images/yoga.png'
import stats from '../assets/images/stats.png';
import settings from '../assets/images/settings.png';
import { SideMenuButton } from "./button/SideMenuButton";
import { useAppTheme } from "../contexts/ThemeContext";
import { useUser } from "../contexts/UserContext";
import NightlightIcon from '@mui/icons-material/Nightlight';
import LightModeIcon from '@mui/icons-material/LightMode';
import LogoutIcon from '@mui/icons-material/Logout';

type props = {
    onSidebarWidthChange: (arg0: number) => void;
    openProp: boolean;
};

export function SideNav(props: props) {
    const { darkMode, toggleTheme } = useAppTheme();
    const { user, logout } = useUser();
    const [open, setOpen] = useState(props.openProp);

    const handleMouseEnter = () => {
        setOpen(true);
        props.onSidebarWidthChange(240);
    };

    const handleMouseLeave = () => {
        setOpen(false);
        props.onSidebarWidthChange(75);
    };

    const getInitials = () => {
        if (!user) return '?';
        const first = user.firstName?.[0] ?? '';
        const last = user.lastName?.[0] ?? '';
        return (first + last).toUpperCase() || (user.username?.[0]?.toUpperCase() ?? '?');
    };

    return (
        <Drawer
            variant="permanent"
            anchor="left"
            open={open}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            elevation={24}
            sx={{
                position: 'fixed',
                zIndex: 1000,
                width: open ? 240 : 75,
                '& .MuiDrawer-paper': {
                    width: open ? 240 : 75,
                    overflowX: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    transition: 'width 0.3s ease',
                },
                borderRight: 0.5
            }}
        >
            {/* Nav items */}
            <List sx={{ width: '100%', textAlign: 'center', mt: 1, flexGrow: 1 }}>
                <SideMenuButton image={home as string} text="Home" targetPage="/" open={open} />
                <SideMenuButton image={clipboard as string} text="Tasks" targetPage="/tasks" open={open} />
                <SideMenuButton image={calender as string} text="Calendar" targetPage="/calendar" open={open} />
                <SideMenuButton image={meditation as string} text="Meditation" targetPage="/meditation" open={open} />
                <SideMenuButton image={stats as string} text="Statistics" targetPage="/stats" open={open} />
                <SideMenuButton image={settings as string} text="Settings" targetPage="/settings" open={open} />
            </List>

            {/* Bottom: theme toggle + user info */}
            <Box sx={{ width: '100%', pb: 1 }}>
                <Divider />

                {/* Theme toggle */}
                <Box sx={{
                    display: 'flex',
                    justifyContent: open ? 'flex-start' : 'center',
                    alignItems: 'center',
                    px: open ? 2 : 0,
                    py: 1,
                }}>
                    <Tooltip title={darkMode ? 'Light mode' : 'Dark mode'} placement="right">
                        <IconButton onClick={toggleTheme} size="small">
                            {darkMode ? <LightModeIcon /> : <NightlightIcon />}
                        </IconButton>
                    </Tooltip>
                    {open && (
                        <Typography variant="body2" sx={{ ml: 2, opacity: open ? 1 : 0, transition: 'opacity 0.3s ease' }}>
                            {darkMode ? 'Light mode' : 'Dark mode'}
                        </Typography>
                    )}
                </Box>

                <Divider />

                {/* User section */}
                {user && (
                    <Box sx={{
                        display: 'flex',
                        alignItems: 'center',
                        px: open ? 1.5 : 0,
                        py: 1.5,
                        justifyContent: open ? 'flex-start' : 'center',
                        gap: 1.5,
                    }}>
                        <Tooltip title={open ? '' : `${user.firstName} ${user.lastName}`} placement="right">
                            <Avatar sx={{ width: 36, height: 36, bgcolor: 'primary.main', flexShrink: 0, fontSize: '0.875rem' }}>
                                {getInitials()}
                            </Avatar>
                        </Tooltip>
                        {open && (
                            <Box sx={{ minWidth: 0, flexGrow: 1, opacity: 1, transition: 'opacity 0.3s ease' }}>
                                <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {user.firstName} {user.lastName}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                                    {user.email}
                                </Typography>
                            </Box>
                        )}
                        {open && (
                            <Tooltip title="Logout">
                                <IconButton onClick={logout} size="small" sx={{ flexShrink: 0 }}>
                                    <LogoutIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        )}
                    </Box>
                )}
                {/* Logout icon when collapsed */}
                {user && !open && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', pb: 0.5 }}>
                        <Tooltip title="Logout" placement="right">
                            <IconButton onClick={logout} size="small">
                                <LogoutIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </Box>
                )}
            </Box>
        </Drawer>
    );
}
