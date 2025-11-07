import { Box } from "@mui/material";
import { SideNav } from "./SideNav.tsx";
import { ReactNode, useState } from "react";

interface PageWrapperProps {
    children: ReactNode;
}

export function PageWrapper({ children }: PageWrapperProps) {
    const [sidenavOpen, setSidenavOpen] = useState(false);
    const [sidebarWidth, setSidebarWidth] = useState(75);

    return (
        <Box sx={{
            display: 'flex',
            height: '100vh', // Full viewport height
            overflow: 'hidden' // Prevent outer scroll
        }}>
            <SideNav
                onSidebarWidthChange={setSidebarWidth}
                openProp={sidenavOpen}
            />
            <Box sx={(theme) => ({
                display: 'flex',
                flexDirection: 'column', // Stack children vertically
                flexGrow: 1,
                height: '100vh',
                overflowY: 'auto',
                marginLeft: `${sidebarWidth}px`,
                ...(sidenavOpen && {
                    transition: theme.transitions.create('margin', {
                        easing: theme.transitions.easing.easeOut,
                        duration: theme.transitions.duration.enteringScreen,
                    }),
                    marginLeft: 0,
                }),
                transition: theme.transitions.create('margin', {
                    easing: theme.transitions.easing.sharp,
                    duration: theme.transitions.duration.leavingScreen,
                }),
                padding: 2,
            })}>
                {children}
            </Box>
        </Box>
    );
}