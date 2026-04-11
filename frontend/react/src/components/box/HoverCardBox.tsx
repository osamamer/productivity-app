import {Box, Card} from "@mui/material";
import React, {ReactElement, ReactNode} from "react";
import {string} from "yup";

interface props {
    children: ReactNode,
    display?: (theme: any) => any,
    maximumWidth?: string,
    maximumHeight?: string,
    height?: string,
    hover?: boolean,
    variant?: 'default' | 'paper',
}

export function HoverCardBox({children, display, maximumWidth, maximumHeight, height, hover = true, variant = 'default'}: props) {
    return (
        <Box
            sx={(theme) => ({
                display: display ? display(theme) : "block",
                flexDirection: "column",
                gap: 1,
                px: variant === 'paper' ? 2.5 : 2,
                py: variant === 'paper' ? 2.25 : 2,
                backgroundColor: variant === 'paper' ? 'background.paper' : 'transparent',
                "&:hover": !hover ? {} : {transform: "scale(1.01)", boxShadow: 6},
                transition: "transform 0.3s, box-shadow 0.3s",
                boxShadow: variant === 'paper' ? '0 2px 16px rgba(0,0,0,0.06)' : 3,
                borderRadius: variant === 'paper' ? 3 : 2,
                maxWidth: maximumWidth ? maximumWidth : '100%',
                maxHeight: maximumHeight ? maximumHeight : '100%',
                height: height,
            })}
        >
            {children}
        </Box>
    );
}
