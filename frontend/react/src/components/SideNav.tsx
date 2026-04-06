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
import { useState, useRef } from "react";
import HomeIcon from '@mui/icons-material/Home';
import AssignmentIcon from '@mui/icons-material/Assignment';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import SelfImprovementIcon from '@mui/icons-material/SelfImprovement';
import BarChartIcon from '@mui/icons-material/BarChart';
import SettingsIcon from '@mui/icons-material/Settings';
import NightlightIcon from '@mui/icons-material/Nightlight';
import LightModeIcon from '@mui/icons-material/LightMode';
import LogoutIcon from '@mui/icons-material/Logout';
import { SideMenuButton } from "./button/SideMenuButton";
import { useAppTheme } from "../contexts/ThemeContext";
import { useUser } from "../contexts/UserContext";

const COLLAPSED_WIDTH = 64;
const EXPANDED_WIDTH = 220;

export function SideNav() {
    const { darkMode, toggleTheme } = useAppTheme();
    const { user, logout } = useUser();
    const [open, setOpen] = useState(false);
    const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleMouseEnter = () => {
        if (closeTimer.current) clearTimeout(closeTimer.current);
        setOpen(true);
    };

    const handleMouseLeave = () => {
        closeTimer.current = setTimeout(() => setOpen(false), 50);
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
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            sx={{
                width: open ? EXPANDED_WIDTH : COLLAPSED_WIDTH,
                flexShrink: 0,
                transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                '& .MuiDrawer-paper': {
                    width: open ? EXPANDED_WIDTH : COLLAPSED_WIDTH,
                    overflowX: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxSizing: 'border-box',
                },
            }}
        >
            {/* Nav items */}
            <List sx={{ width: '100%', textAlign: 'center', mt: 1, flexGrow: 1 }}>
                <SideMenuButton Icon={HomeIcon}            text="Home"       targetPage="/"          open={open} />
                <SideMenuButton Icon={AssignmentIcon}      text="Tasks"      targetPage="/tasks"     open={open} />
                <SideMenuButton Icon={CalendarMonthIcon}   text="Calendar"   targetPage="/calendar"  open={open} />
                <SideMenuButton Icon={SelfImprovementIcon} text="Meditation" targetPage="/meditation" open={open} />
                <SideMenuButton Icon={BarChartIcon}        text="Statistics" targetPage="/stats"     open={open} />
                <SideMenuButton Icon={SettingsIcon}        text="Settings"   targetPage="/settings"  open={open} />
            </List>

            {/* Bottom: theme toggle + user info */}
            <Box sx={{ width: '100%', pb: 1 }}>
                <Divider />

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
                        <Typography variant="body2" sx={{ ml: 2 }}>
                            {darkMode ? 'Light mode' : 'Dark mode'}
                        </Typography>
                    )}
                </Box>

                <Divider />

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
                            <Avatar sx={{ width: 34, height: 34, bgcolor: 'primary.main', flexShrink: 0, fontSize: '0.8rem' }}>
                                {getInitials()}
                            </Avatar>
                        </Tooltip>
                        {open && (
                            <>
                                <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                                    <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {user.firstName} {user.lastName}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                                        {user.email}
                                    </Typography>
                                </Box>
                                <Tooltip title="Logout">
                                    <IconButton onClick={logout} size="small" sx={{ flexShrink: 0 }}>
                                        <LogoutIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            </>
                        )}
                    </Box>
                )}
            </Box>
        </Drawer>
    );
}
