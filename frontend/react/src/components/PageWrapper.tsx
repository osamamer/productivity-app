import { Box } from "@mui/material";
import { SideNav } from "./SideNav.tsx";
import { ReactNode } from "react";

interface PageWrapperProps {
    children: ReactNode;
    hideNavigation?: boolean;
    flush?: boolean;
}

export function PageWrapper({ children, hideNavigation = false, flush = false }: PageWrapperProps) {
    return (
        <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
            {!hideNavigation && <SideNav />}
            <Box sx={{
                flexGrow: 1,
                display: 'flex',
                flexDirection: 'column',
                height: '100vh',
                overflowY: 'auto',
                padding: flush ? 0 : 2,
            }}>
                {children}
            </Box>
        </Box>
    );
}
