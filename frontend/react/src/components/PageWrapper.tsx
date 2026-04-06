import { Box } from "@mui/material";
import { SideNav } from "./SideNav.tsx";
import { ReactNode } from "react";

interface PageWrapperProps {
    children: ReactNode;
}

export function PageWrapper({ children }: PageWrapperProps) {
    return (
        <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
            <SideNav />
            <Box sx={{
                flexGrow: 1,
                display: 'flex',
                flexDirection: 'column',
                height: '100vh',
                overflowY: 'auto',
                padding: 2,
            }}>
                {children}
            </Box>
        </Box>
    );
}
