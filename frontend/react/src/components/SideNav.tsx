import {
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
    Typography,
    useMediaQuery,
    useTheme,
} from '@mui/material';
import { type Theme } from '@mui/material/styles';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { SvgIconComponent } from '@mui/icons-material';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import AssignmentIcon from '@mui/icons-material/Assignment';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import BarChartIcon from '@mui/icons-material/BarChart';
import SettingsIcon from '@mui/icons-material/Settings';
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded';
import PsychologyIcon from '@mui/icons-material/Psychology';
import SelfImprovementRoundedIcon from '@mui/icons-material/SelfImprovementRounded';
import NightlightIcon from '@mui/icons-material/Nightlight';
import LightModeIcon from '@mui/icons-material/LightMode';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import KeyboardDoubleArrowRightRoundedIcon from '@mui/icons-material/KeyboardDoubleArrowRightRounded';
import KeyboardDoubleArrowLeftRoundedIcon from '@mui/icons-material/KeyboardDoubleArrowLeftRounded';
import { SideMenuButton } from './button/SideMenuButton';
import { useAppTheme } from '../hooks/useAppTheme';
import { useUser } from '../hooks/useUser';
import { sideNavSnapshotCache, type TodaySnapshot } from '../services/cache/sideNavSnapshotCache';

const COLLAPSED_WIDTH = 60;
const EXPANDED_WIDTH = 260;
const SIDE_NAV_STORAGE_KEY = 'claritard.sideNav.expanded';
const DRAWER_TRANSITION_MS = 220;

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
    '&.Mui-selected': {
        backgroundColor: 'action.hover',
    },
    '&.Mui-selected:hover': {
        backgroundColor: 'action.hover',
    },
};

const mentalPaths = ['/mental', '/mental-state', '/mental-threads', '/meditation'];

function readInitialOpen(): boolean {
    if (typeof window === 'undefined') return false;

    try {
        return window.localStorage.getItem(SIDE_NAV_STORAGE_KEY) === 'true';
    } catch (error) {
        console.warn('Could not read the navigation preference:', error);
        return false;
    }
}

type SideNavActionProps = {
    Icon: SvgIconComponent;
    text: string;
    onClick: () => void;
    selected?: boolean;
    expanded: boolean;
};

function SideNavAction({ Icon, text, onClick, selected = false, expanded }: SideNavActionProps) {
    return (
        <ListItemButton
            selected={selected}
            onClick={onClick}
            title={text}
            aria-label={text}
            sx={navActionSx}
        >
            <Box sx={iconRailSx}>
                <Icon sx={{ fontSize: 20 }} />
            </Box>
            <Typography
                noWrap
                variant="body2"
                sx={{
                    minWidth: 0,
                    flex: 1,
                    textAlign: 'left',
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

type SideNavSubItemProps = {
    Icon: SvgIconComponent;
    text: string;
    targetPage: string;
    activePaths?: string[];
    onNavigate?: (targetPage: string) => void;
};

function SideNavSubItem({
    Icon,
    text,
    targetPage,
    activePaths = [targetPage],
    onNavigate,
}: SideNavSubItemProps) {
    const navigate = useNavigate();
    const location = useLocation();
    const isActive = activePaths.includes(location.pathname);

    return (
        <ListItemButton
            selected={isActive}
            onClick={() => {
                if (onNavigate) {
                    onNavigate(targetPage);
                } else {
                    navigate(targetPage);
                }
            }}
            sx={{
                minHeight: 38,
                borderRadius: 1,
                px: 1.25,
                gap: 1,
                '&.Mui-selected': {
                    backgroundColor: 'transparent',
                    color: 'primary.main',
                },
                '&.Mui-selected:hover': {
                    backgroundColor: 'transparent',
                },
                '&:hover': {
                    backgroundColor: 'transparent',
                },
            }}
        >
            <Icon sx={{ fontSize: 17, color: isActive ? 'primary.main' : 'text.secondary' }} />
            <Typography noWrap variant="body2" sx={{ fontWeight: isActive ? 600 : 400 }}>
                {text}
            </Typography>
        </ListItemButton>
    );
}

type MetricTone = 'bad' | 'caution' | 'good' | 'neutral';

function getMetricToneStyles(theme: Theme, tone: MetricTone) {
    const accent = tone === 'bad'
        ? theme.palette.error.main
        : tone === 'caution'
            ? theme.palette.warning.main
            : tone === 'good'
                ? theme.palette.success.main
                : theme.palette.text.secondary;
    return { accent };
}

function getOpenTaskTone(count: number | null): MetricTone {
    if (count === null) return 'neutral';
    if (count > 6) return 'bad';
    if (count > 3) return 'caution';
    return 'good';
}

function getFocusTone(seconds: number | null): MetricTone {
    if (seconds === null) return 'neutral';
    const hours = seconds / 3600;
    if (hours < 1) return 'bad';
    if (hours < 2) return 'caution';
    return 'good';
}

function getMentalStateTone(state: string | null): MetricTone {
    if (!state) return 'neutral';
    if (state === 'Ready' || state === 'Engaged') return 'good';
    if (state === 'Almost Ready' || state === 'Mixed' || state === 'Stimulation-Seeking') return 'caution';
    return 'bad';
}

function SnapshotMetric({ value, label, tone }: { value: string; label: string; tone: MetricTone }) {
    const theme = useTheme();
    const styles = getMetricToneStyles(theme, tone);

    return (
        <Box
            sx={{
                minWidth: 0,
                p: 0.5,
            }}
        >
            <Typography
                noWrap
                variant="body2"
                sx={{
                    color: styles.accent,
                    fontWeight: 700,
                }}
            >
                {value}
            </Typography>
            <Typography noWrap variant="caption" color="text.secondary">
                {label}
            </Typography>
        </Box>
    );
}

function TodaySnapshotCard({ snapshot, onNavigate }: { snapshot: TodaySnapshot | null; onNavigate?: (targetPage: string) => void }) {
    const navigate = useNavigate();
    const mentalStateTone = getMentalStateTone(snapshot?.mentalState ?? null);
    const openTaskLabel = snapshot?.openTaskCount === null || snapshot === null
        ? '—'
        : String(snapshot.openTaskCount);
    const focusLabel = snapshot?.focusSeconds === null || snapshot === null
        ? '—'
        : `${(snapshot.focusSeconds / 3600).toFixed(1)}h`;

    return (
        <Box
            sx={{
                display: 'grid',
                gap: 0.75,
            }}
        >
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                Today at a glance
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.75 }}>
                <SnapshotMetric
                    value={openTaskLabel}
                    label="Open tasks"
                    tone={getOpenTaskTone(snapshot?.openTaskCount ?? null)}
                />
                <SnapshotMetric
                    value={focusLabel}
                    label="Hours focused"
                    tone={getFocusTone(snapshot?.focusSeconds ?? null)}
                />
                <Box sx={{ gridColumn: '1 / -1', minHeight: 52 }}>
                    {snapshot === null ? (
                        <SnapshotMetric value="Checking" label="mental state" tone="neutral" />
                    ) : snapshot.mentalState ? (
                        <SnapshotMetric value={snapshot.mentalState} label="mental state" tone={mentalStateTone} />
                    ) : (
                        <Box>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                Mental state
                            </Typography>
                            <Button
                                size="small"
                                onClick={() => {
                                    if (onNavigate) {
                                        onNavigate('/mental-state');
                                    } else {
                                        navigate('/mental-state');
                                    }
                                }}
                                sx={{ minWidth: 0, px: 0, py: 0, justifyContent: 'flex-start' }}
                            >
                                Check in now
                            </Button>
                        </Box>
                    )}
                </Box>
            </Box>
        </Box>
    );
}

function DrawerExpandable({ open, children }: { open: boolean; children: ReactNode }) {
    return (
        <Box
            aria-hidden={!open}
            sx={{
                display: 'grid',
                gridTemplateRows: open ? '1fr' : '0fr',
                opacity: open ? 1 : 0,
                overflow: 'hidden',
                pointerEvents: open ? 'auto' : 'none',
                transition: `grid-template-rows ${DRAWER_TRANSITION_MS}ms cubic-bezier(0.4, 0, 0.2, 1), opacity ${DRAWER_TRANSITION_MS}ms ease`,
                visibility: open ? 'visible' : 'hidden',
                '& > .SideNav-expandable-content': {
                    minHeight: 0,
                    overflow: 'hidden',
                },
            }}
        >
            <Box className="SideNav-expandable-content">{children}</Box>
        </Box>
    );
}

export function SideNav() {
    const { darkMode, toggleTheme } = useAppTheme();
    const { user, logout } = useUser();
    const navigate = useNavigate();
    const location = useLocation();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const [open, setOpen] = useState(readInitialOpen);
    const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
    const [todaySnapshot, setTodaySnapshot] = useState<TodaySnapshot | null>(
        () => sideNavSnapshotCache.getCached() ?? null,
    );
    const pendingNavigationRef = useRef<number | null>(null);

    useEffect(() => {
        try {
            window.localStorage.setItem(SIDE_NAV_STORAGE_KEY, String(open));
        } catch (error) {
            console.warn('Could not save the navigation preference:', error);
        }
    }, [open]);

    useEffect(() => {
        let cancelled = false;

        const loadTodaySnapshot = async () => {
            const cachedSnapshot = sideNavSnapshotCache.getCached();
            if (cachedSnapshot) setTodaySnapshot(cachedSnapshot);

            const snapshot = await sideNavSnapshotCache.get();
            if (!cancelled) setTodaySnapshot(sideNavSnapshotCache.getCached() ?? snapshot);
        };

        void loadTodaySnapshot();
        const refreshInterval = window.setInterval(() => {
            void loadTodaySnapshot();
        }, 30_000);

        return () => {
            cancelled = true;
            window.clearInterval(refreshInterval);
        };
    }, []);

    useEffect(() => sideNavSnapshotCache.subscribe(setTodaySnapshot), []);

    const closeDrawer = useCallback(() => {
        setOpen(false);
    }, []);

    const navigateFromDrawer = useCallback((targetPage: string) => {
        if (pendingNavigationRef.current !== null) {
            window.clearTimeout(pendingNavigationRef.current);
            pendingNavigationRef.current = null;
        }

        closeDrawer();

        if (!open || location.pathname === targetPage) {
            if (location.pathname !== targetPage) navigate(targetPage);
            return;
        }

        // Let the close state paint before a page with expensive initial rendering runs.
        pendingNavigationRef.current = window.setTimeout(() => {
            pendingNavigationRef.current = null;
            navigate(targetPage);
        }, DRAWER_TRANSITION_MS);
    }, [closeDrawer, location.pathname, navigate, open]);

    useEffect(() => () => {
        if (pendingNavigationRef.current !== null) {
            window.clearTimeout(pendingNavigationRef.current);
        }
    }, []);

    const drawerWidth = isMobile ? EXPANDED_WIDTH : (open ? EXPANDED_WIDTH : COLLAPSED_WIDTH);
    const drawerTransition = theme.transitions.create('width', {
        duration: DRAWER_TRANSITION_MS,
        easing: theme.transitions.easing.easeInOut,
    });

    return (
        <>
            {isMobile && !open && (
                <IconButton
                    onClick={() => setOpen(true)}
                    aria-label="Open navigation"
                    sx={{
                        position: 'fixed',
                        top: 10,
                        left: 10,
                        zIndex: theme.zIndex.drawer + 1,
                        backgroundColor: 'background.paper',
                        boxShadow: 2,
                        '&:hover': { backgroundColor: 'background.paper' },
                    }}
                >
                    <MenuRoundedIcon />
                </IconButton>
            )}

            <Drawer
                variant={isMobile ? 'temporary' : 'permanent'}
                anchor="left"
                open={isMobile ? open : true}
                onClose={() => setOpen(false)}
                ModalProps={{ keepMounted: true }}
                sx={{
                    width: isMobile ? 0 : drawerWidth,
                    flexShrink: 0,
                    transition: drawerTransition,
                    '& .MuiDrawer-paper': {
                        width: drawerWidth,
                        overflowX: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        boxSizing: 'border-box',
                        transition: drawerTransition,
                        pt: 0,
                    },
                }}
            >
                <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', minHeight: 56 }}>
                        <Box sx={{ width: COLLAPSED_WIDTH, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
                            <IconButton
                                onClick={() => setOpen((current) => !current)}
                                size="small"
                                title={open ? 'Collapse navigation' : 'Expand navigation'}
                                aria-label={open ? 'Collapse navigation' : 'Expand navigation'}
                                sx={{ p: 0.75 }}
                            >
                                {open
                                    ? <KeyboardDoubleArrowLeftRoundedIcon sx={{ fontSize: 20 }} />
                                    : <KeyboardDoubleArrowRightRoundedIcon sx={{ fontSize: 20 }} />}
                            </IconButton>
                        </Box>
                        <Typography
                            noWrap
                            sx={{
                                fontWeight: 700,
                                letterSpacing: '-0.01em',
                                opacity: open ? 1 : 0,
                                visibility: open ? 'visible' : 'hidden',
                                transition: `opacity ${DRAWER_TRANSITION_MS}ms ease`,
                            }}
                        >
                            Claritard
                        </Typography>
                    </Box>

                    <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                        <List sx={{ width: '100%', py: 0 }}>
                            <SideMenuButton
                                Icon={DashboardRoundedIcon}
                                text="Home"
                                targetPage="/"
                                expanded={open}
                                onNavigate={navigateFromDrawer}
                            />
                            <DrawerExpandable open={open}>
                                <Box
                                    sx={{
                                        ml: 1.5,
                                        mr: 1.5,
                                        mb: 1,
                                        pl: 1,
                                        borderLeft: 2,
                                        borderColor: location.pathname === '/' ? 'primary.main' : 'divider',
                                        borderRadius: '0 10px 10px 0',
                                    }}
                                >
                                    <TodaySnapshotCard snapshot={todaySnapshot} onNavigate={navigateFromDrawer} />
                                </Box>
                            </DrawerExpandable>
                            <SideMenuButton
                                Icon={AssignmentIcon}
                                text="Tasks"
                                targetPage="/tasks"
                                expanded={open}
                                onNavigate={navigateFromDrawer}
                            />
                            <SideMenuButton
                                Icon={PsychologyIcon}
                                text="Mental"
                                targetPage="/mental"
                                activePaths={mentalPaths}
                                expanded={open}
                                onNavigate={navigateFromDrawer}
                            />
                            <DrawerExpandable open={open}>
                                <Box
                                    sx={{
                                    ml: 3.5,
                                    mr: 1.5,
                                    mb: 1,
                                    pl: 1,
                                    borderLeft: 2,
                                    borderColor: mentalPaths.includes(location.pathname) ? 'primary.main' : 'divider',
                                    borderRadius: '0 10px 10px 0',
                                }}
                                >
                                    <List disablePadding>
                                        <SideNavSubItem
                                            Icon={PsychologyIcon}
                                            text="State"
                                            targetPage="/mental-state"
                                            activePaths={['/mental-state']}
                                            onNavigate={navigateFromDrawer}
                                        />
                                        <SideNavSubItem
                                            Icon={AssignmentIcon}
                                            text="Threads"
                                            targetPage="/mental-threads"
                                            activePaths={['/mental-threads']}
                                            onNavigate={navigateFromDrawer}
                                        />
                                        <SideNavSubItem
                                            Icon={SelfImprovementRoundedIcon}
                                            text="Meditation"
                                            targetPage="/meditation"
                                            activePaths={['/meditation']}
                                            onNavigate={navigateFromDrawer}
                                        />
                                    </List>
                                </Box>
                            </DrawerExpandable>
                            <SideMenuButton
                                Icon={EditNoteRoundedIcon}
                                text="Notes"
                                targetPage="/notes"
                                expanded={open}
                                onNavigate={navigateFromDrawer}
                            />
                            <SideMenuButton
                                Icon={CalendarMonthIcon}
                                text="Calendar"
                                targetPage="/calendar"
                                expanded={open}
                                onNavigate={navigateFromDrawer}
                            />
                            <SideMenuButton
                                Icon={BarChartIcon}
                                text="Statistics"
                                targetPage="/stats"
                                expanded={open}
                                onNavigate={navigateFromDrawer}
                            />
                        </List>
                    </Box>

                    <Divider />
                    <Box sx={{ width: '100%', pb: 1 }}>
                        <SideNavAction
                            Icon={darkMode ? LightModeIcon : NightlightIcon}
                            text={darkMode ? 'Light mode' : 'Dark mode'}
                            expanded={open}
                            onClick={toggleTheme}
                        />
                        <SideNavAction
                            Icon={SettingsIcon}
                            text="Settings"
                            expanded={open}
                            selected={location.pathname === '/settings'}
                            onClick={() => {
                                navigateFromDrawer('/settings');
                            }}
                        />
                        {user && (
                            <SideNavAction
                                Icon={LogoutIcon}
                                text="Log out"
                                expanded={open}
                                onClick={() => setLogoutDialogOpen(true)}
                            />
                        )}
                    </Box>
                </Box>
            </Drawer>

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
        </>
    );
}
