import { Box } from '@mui/material';
import { useMemo, useState } from 'react';

import { NavigationVisibilityContext } from './appShellNavigation';
import { PageTransition } from './PageTransition';
import { SideNav } from './SideNav';

export function AppShell() {
    const [navigationVisible, setNavigationVisible] = useState(true);
    const navigationContext = useMemo(() => ({
        visible: navigationVisible,
        setVisible: setNavigationVisible,
    }), [navigationVisible]);

    return (
        <NavigationVisibilityContext.Provider value={navigationContext}>
            <Box sx={{ display: 'flex', height: '100vh', minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
                <Box sx={{ display: navigationVisible ? 'block' : 'none', flexShrink: 0 }}>
                    <SideNav />
                </Box>
                <Box sx={{
                    flexGrow: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100vh',
                    minWidth: 0,
                    minHeight: 0,
                    overflowY: 'auto',
                    scrollbarGutter: 'stable',
                }}>
                    <PageTransition />
                </Box>
            </Box>
        </NavigationVisibilityContext.Provider>
    );
}
