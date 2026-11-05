import { Alert, Box, IconButton, Snackbar } from '@mui/material';
import { keyframes } from '@mui/system';
import MenuOpenRoundedIcon from '@mui/icons-material/MenuOpenRounded';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBlocker } from 'react-router-dom';

import { NavigationVisibilityContext } from './appShellNavigation';
import { PageTransition } from './PageTransition';
import { SideNav } from './SideNav';
import { usePomodoro } from '../hooks/usePomodoro';
import { isFocusNavigationLocked } from '../services/utils/focusNavigation';

const rejectNavigationShake = keyframes`
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-5px); }
    50% { transform: translateX(4px); }
    75% { transform: translateX(-3px); }
`;

export function AppShell() {
    const [navigationVisible, setNavigationVisible] = useState(true);
    const [focusNavigationRevealed, setFocusNavigationRevealed] = useState(false);
    const [blockedNoticeOpen, setBlockedNoticeOpen] = useState(false);
    const [shakeSideNav, setShakeSideNav] = useState(false);
    const { activePomodoro } = usePomodoro();
    const focusNavigationLocked = isFocusNavigationLocked(activePomodoro);
    const focusNavigationLockedRef = useRef(focusNavigationLocked);
    focusNavigationLockedRef.current = focusNavigationLocked;
    const shakeTimeoutRef = useRef<number | null>(null);
    const focusBlocker = useBlocker(({ currentLocation, nextLocation }) => (
        focusNavigationLocked
        && (currentLocation.pathname !== nextLocation.pathname
            || currentLocation.search !== nextLocation.search
            || currentLocation.hash !== nextLocation.hash)
    ));
    const focusBlockerState = focusBlocker.state;
    const navigationIsVisible = focusNavigationLocked
        ? focusNavigationRevealed
        : navigationVisible;
    const setPageNavigationVisible = useCallback((visible: boolean) => {
        if (!focusNavigationLockedRef.current) setNavigationVisible(visible);
    }, []);

    useEffect(() => {
        setFocusNavigationRevealed(false);
    }, [focusNavigationLocked]);

    useEffect(() => {
        if (focusBlockerState !== 'blocked') return;

        focusBlocker.reset();
        setFocusNavigationRevealed(false);
        setBlockedNoticeOpen(true);
        setShakeSideNav(false);
        window.requestAnimationFrame(() => setShakeSideNav(true));
        if (shakeTimeoutRef.current !== null) window.clearTimeout(shakeTimeoutRef.current);
        shakeTimeoutRef.current = window.setTimeout(() => setShakeSideNav(false), 420);
    }, [focusBlockerState]);

    useEffect(() => () => {
        if (shakeTimeoutRef.current !== null) window.clearTimeout(shakeTimeoutRef.current);
    }, []);

    const navigationContext = useMemo(() => ({
        visible: navigationIsVisible,
        focusLocked: focusNavigationLocked,
        setVisible: setPageNavigationVisible,
    }), [focusNavigationLocked, navigationIsVisible, setPageNavigationVisible]);

    return (
        <NavigationVisibilityContext.Provider value={navigationContext}>
            <Box sx={{ display: 'flex', height: '100%', minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
                <Box
                    sx={{
                        display: navigationIsVisible ? 'block' : 'none',
                        flexShrink: 0,
                        animation: shakeSideNav ? `${rejectNavigationShake} 360ms ease-in-out` : 'none',
                    }}
                >
                    <SideNav />
                </Box>
                {focusNavigationLocked && !focusNavigationRevealed && (
                    <IconButton
                        aria-label="Show navigation"
                        title="Show navigation"
                        onClick={() => setFocusNavigationRevealed(true)}
                        sx={{
                            position: 'fixed',
                            top: '50%',
                            left: 0,
                            zIndex: theme => theme.zIndex.drawer + 1,
                            transform: 'translateY(-50%)',
                            width: 36,
                            height: 48,
                            border: 1,
                            borderLeft: 0,
                            borderRadius: '0 12px 12px 0',
                            borderColor: 'divider',
                            backgroundColor: 'background.paper',
                            boxShadow: 2,
                            '&:hover': { backgroundColor: 'action.hover' },
                        }}
                    >
                        <MenuOpenRoundedIcon fontSize="small" />
                    </IconButton>
                )}
                <Box sx={{
                    flexGrow: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                    minWidth: 0,
                    minHeight: 0,
                    overflowY: 'auto',
                    scrollbarGutter: 'stable',
                }}>
                    <PageTransition />
                </Box>
                <Snackbar
                    open={blockedNoticeOpen}
                    autoHideDuration={3600}
                    onClose={() => setBlockedNoticeOpen(false)}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                >
                    <Alert severity="info" variant="filled" onClose={() => setBlockedNoticeOpen(false)}>
                        Stay with your focus session; finish it before changing pages.
                    </Alert>
                </Snackbar>
            </Box>
        </NavigationVisibilityContext.Provider>
    );
}
