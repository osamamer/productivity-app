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
import { useEffect, useRef, useState } from "react";
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

const COLLAPSED_WIDTH = 60;
const EXPANDED_WIDTH = 175;

export function SideNav() {
    const { darkMode, toggleTheme } = useAppTheme();
    const { user, logout } = useUser();
    const [open, setOpen] = useState(false);
    const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (closeTimer.current) {
                clearTimeout(closeTimer.current);
            }
        };
    }, []);

    const handleMouseEnter = () => {
        if (closeTimer.current) {
            clearTimeout(closeTimer.current);
            closeTimer.current = null;
        }
        setOpen(true);
    };

    const handleMouseLeave = () => {
        closeTimer.current = setTimeout(() => {
            setOpen(false);
            closeTimer.current = null;
        }, 80);
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
                    pt: 1,
                },
            }}
        >
            {/* Nav items */}
            <List sx={{ width: '100%', textAlign: 'center', flexGrow: 1, py: 0 }}>
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

                <Box sx={{ height: 44, display: 'flex', alignItems: 'center' }}>
                    {/* Fixed icon zone — always COLLAPSED_WIDTH wide so icon never moves */}
                    <Box sx={{ width: COLLAPSED_WIDTH, flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <Tooltip title={open ? '' : (darkMode ? 'Light mode' : 'Dark mode')} placement="right">
                            <IconButton onClick={toggleTheme} size="small" sx={{ p: 0.75 }}>
                                {darkMode ? <LightModeIcon sx={{ fontSize: 19 }} /> : <NightlightIcon sx={{ fontSize: 19 }} />}
                            </IconButton>
                        </Tooltip>
                    </Box>
                    <Typography variant="body2" sx={{
                        fontSize: '0.82rem',
                        opacity: open ? 1 : 0,
                        transition: 'opacity 0.2s ease',
                        whiteSpace: 'nowrap',
                    }}>
                        {darkMode ? 'Light mode' : 'Dark mode'}
                    </Typography>
                </Box>

                <Divider />

                {user && (
                    <Box sx={{ height: 58, display: 'flex', alignItems: 'center', pr: 1 }}>
                        {/* Fixed icon zone */}
                        <Box sx={{ width: COLLAPSED_WIDTH, flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                            <Tooltip title={open ? '' : `${user.firstName} ${user.lastName}`} placement="right">
                                <Avatar sx={{ width: 30, height: 30, bgcolor: 'primary.main', flexShrink: 0, fontSize: '0.72rem' }}>
                                    {getInitials()}
                                </Avatar>
                            </Tooltip>
                        </Box>
                        <Box sx={{
                            minWidth: 0,
                            flexGrow: 1,
                            opacity: open ? 1 : 0,
                            transition: 'opacity 0.2s ease',
                        }}>
                            <Typography variant="body2" sx={{ fontSize: '0.82rem', fontWeight: 600, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {user.firstName} {user.lastName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                                {user.email}
                            </Typography>
                        </Box>
                        <Tooltip title="Logout">
                            <IconButton
                                onClick={logout}
                                size="small"
                                sx={{
                                    flexShrink: 0,
                                    opacity: open ? 1 : 0,
                                    transition: 'opacity 0.2s ease',
                                    p: 0.75,
                                }}
                            >
                                <LogoutIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </Box>
                )}
            </Box>
        </Drawer>
    );
}
