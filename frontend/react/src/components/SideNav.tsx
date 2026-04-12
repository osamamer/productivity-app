import {
    Avatar,
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    Divider,
    Drawer,
    IconButton,
    List,
    ListItemButton,
} from "@mui/material";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import AssignmentIcon from '@mui/icons-material/Assignment';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import SelfImprovementIcon from '@mui/icons-material/SelfImprovement';
import BarChartIcon from '@mui/icons-material/BarChart';
import SettingsIcon from '@mui/icons-material/Settings';
import NightlightIcon from '@mui/icons-material/Nightlight';
import LightModeIcon from '@mui/icons-material/LightMode';
import LogoutIcon from '@mui/icons-material/Logout';
import KeyboardDoubleArrowRightRoundedIcon from '@mui/icons-material/KeyboardDoubleArrowRightRounded';
import KeyboardDoubleArrowLeftRoundedIcon from '@mui/icons-material/KeyboardDoubleArrowLeftRounded';
import { SideMenuButton } from "./button/SideMenuButton";
import { useAppTheme } from "../contexts/ThemeContext";
import { useUser } from "../contexts/UserContext";

const COLLAPSED_WIDTH = 60;
const EXPANDED_WIDTH = 320;
const iconRailSx = {
    width: COLLAPSED_WIDTH,
    flexShrink: 0,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    '& svg': {
        transition: 'transform 0.16s ease',
    },
};
const navActionSx = {
    minHeight: 44,
    alignItems: 'center',
    px: 0,
    py: 0,
    '&:hover': {
        backgroundColor: 'transparent',
    },
    '&:hover svg': {
        transform: 'scale(1.08)',
    },
};

export function SideNav() {
    const { darkMode, toggleTheme } = useAppTheme();
    const { user, logout } = useUser();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);

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
            sx={{
                width: open ? EXPANDED_WIDTH : COLLAPSED_WIDTH,
                flexShrink: 0,
                transition: 'width 0.28s ease',
                '& .MuiDrawer-paper': {
                    width: open ? EXPANDED_WIDTH : COLLAPSED_WIDTH,
                    overflowX: 'hidden',
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'stretch',
                    transition: 'width 0.28s ease',
                    boxSizing: 'border-box',
                    pt: 0,
                },
            }}
        >
            <Box sx={{ width: COLLAPSED_WIDTH, display: 'flex', flexDirection: 'column', alignItems: 'stretch', pt: 1 }}>
                <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', minHeight: 44 }}>
                    <Box sx={{ width: COLLAPSED_WIDTH, display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
                        <IconButton
                            onClick={() => setOpen((current) => !current)}
                            size="small"
                            title={open ? 'Collapse navigation' : 'Expand navigation'}
                            aria-label={open ? 'Collapse navigation' : 'Expand navigation'}
                            sx={{ p: 0.75 }}
                        >
                            {open ? <KeyboardDoubleArrowLeftRoundedIcon sx={{ fontSize: 20 }} /> : <KeyboardDoubleArrowRightRoundedIcon sx={{ fontSize: 20 }} />}
                        </IconButton>
                    </Box>
                </Box>

                <List sx={{ width: '100%', textAlign: 'center', flexGrow: 1, py: 0 }}>
                    <SideMenuButton Icon={DashboardRoundedIcon} text="Home" targetPage="/" />
                    <SideMenuButton Icon={AssignmentIcon} text="Tasks" targetPage="/tasks" />
                    <SideMenuButton Icon={CalendarMonthIcon} text="Calendar" targetPage="/calendar" />
                    <SideMenuButton Icon={SelfImprovementIcon} text="Meditation" targetPage="/meditation" />
                    <SideMenuButton Icon={BarChartIcon} text="Statistics" targetPage="/stats" />
                    <SideMenuButton Icon={SettingsIcon} text="Settings" targetPage="/settings" />
                </List>

                <Box sx={{ width: '100%', pb: 1 }}>
                    <ListItemButton
                        onClick={toggleTheme}
                        title={darkMode ? 'Light mode' : 'Dark mode'}
                        aria-label={darkMode ? 'Light mode' : 'Dark mode'}
                        sx={navActionSx}
                    >
                        <Box sx={iconRailSx}>
                            <IconButton
                                size="small"
                                disableRipple
                                disableFocusRipple
                                sx={{
                                    p: 0.75,
                                    backgroundColor: 'transparent',
                                    border: 'none',
                                    boxShadow: 'none',
                                    '&:hover': {
                                        backgroundColor: 'transparent',
                                    },
                                }}
                            >
                                {darkMode ? <LightModeIcon sx={{ fontSize: 19 }} /> : <NightlightIcon sx={{ fontSize: 19 }} />}
                            </IconButton>
                        </Box>
                    </ListItemButton>


                    {user && (
                        <ListItemButton
                            onClick={() => navigate('/settings?tab=account')}
                            title="Account"
                            aria-label="Account"
                            sx={{
                                ...navActionSx,
                                minHeight: 58,
                            }}
                        >
                            <Box sx={iconRailSx}>
                                <Avatar
                                    sx={{
                                        width: 30,
                                        height: 30,
                                        bgcolor: 'primary.main',
                                        flexShrink: 0,
                                        fontSize: '0.72rem',
                                        transition: 'transform 0.16s ease',
                                        '.MuiListItemButton-root:hover &': {
                                            transform: 'scale(1.05)',
                                        },
                                    }}
                                >
                                    {getInitials()}
                                </Avatar>
                            </Box>
                        </ListItemButton>
                    )}

                    {user && (
                        <ListItemButton
                            onClick={() => setLogoutDialogOpen(true)}
                            title="Logout"
                            aria-label="Logout"
                            sx={navActionSx}
                        >
                            <Box sx={iconRailSx}>
                                <IconButton
                                    size="small"
                                    disableRipple
                                    disableFocusRipple
                                    sx={{
                                        p: 0.75,
                                        backgroundColor: 'transparent',
                                        '&:hover': {
                                            backgroundColor: 'transparent',
                                        },
                                    }}
                                >
                                    <LogoutIcon fontSize="small" />
                                </IconButton>
                            </Box>
                        </ListItemButton>
                    )}
                </Box>
            </Box>

            {open && (
                <>
                    <Divider orientation="vertical" flexItem />
                    <Box
                        sx={{
                            flexGrow: 1,
                            minWidth: 0,
                            px: 2,
                            py: 2,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 1.25,
                        }}
                    >
                        <Box sx={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'text.secondary' }}>
                            Workspace
                        </Box>
                        <Box sx={{ fontSize: '0.95rem', fontWeight: 600, color: 'text.primary', textAlign: 'left' }}>
                            Explorer
                        </Box>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, color: 'text.secondary', textAlign: 'left', fontSize: '0.86rem' }}>
                            <Box>inbox.md</Box>
                            <Box>weekly-plan.ts</Box>
                            <Box>meditation-notes/</Box>
                            <Box>focus-sessions.json</Box>
                            <Box>archive/</Box>
                        </Box>
                    </Box>
                </>
            )}

            <Dialog open={logoutDialogOpen} onClose={() => setLogoutDialogOpen(false)}>
                <DialogTitle>Log out?</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        You will be signed out of the app and returned to the login screen.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setLogoutDialogOpen(false)}>Cancel</Button>
                    <Button
                        color="error"
                        onClick={() => {
                            setLogoutDialogOpen(false);
                            logout();
                        }}
                    >
                        Log out
                    </Button>
                </DialogActions>
            </Dialog>
        </Drawer>
    );
}
