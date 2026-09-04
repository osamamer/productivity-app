import { Box } from "@mui/material";
import { keyframes } from "@mui/system";
import { SideNav } from "./SideNav.tsx";
import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";

const pageReveal = keyframes`
    from {
        opacity: 0;
        transform: translate3d(0, 10px, 0) scale(0.997);
    }
    to {
        opacity: 1;
        transform: none;
    }
`;

interface PageWrapperProps {
    children: ReactNode;
    hideNavigation?: boolean;
    flush?: boolean;
}

export function PageWrapper({ children, hideNavigation = false, flush = false }: PageWrapperProps) {
    const pageContent = isValidElement(children)
        ? cloneElement(children as ReactElement<{ "data-context-menu-space"?: boolean }>, { "data-context-menu-space": true })
        : children;

    return (
        <Box data-context-menu-space sx={{ display: 'flex', height: '100vh', minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
            {!hideNavigation && <SideNav />}
            <Box data-context-menu-space sx={{
                flexGrow: 1,
                display: 'flex',
                flexDirection: 'column',
                height: '100vh',
                minWidth: 0,
                minHeight: 0,
                overflowY: 'auto',
                scrollbarGutter: 'stable',
                padding: flush ? 0 : 2,
            }}>
                <Box
                    data-context-menu-space
                    sx={{
                        flex: 1,
                        minWidth: 0,
                        minHeight: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        transformOrigin: 'center top',
                        animation: `${pageReveal} 420ms cubic-bezier(0.22, 1, 0.36, 1) both`,
                        '@media (prefers-reduced-motion: reduce)': {
                            animation: 'none',
                        },
                    }}
                >
                    {pageContent}
                </Box>
            </Box>
        </Box>
    );
}
