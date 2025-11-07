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
}

export function HoverCardBox({children, display, maximumWidth, maximumHeight, height, hover = true}: props) {
    return (
        <Box
            sx={(theme) => ({
                display: display ? display(theme) : "block",
                flexDirection: "column",
                gap: 1,
                px: 2,
                py: 2,
                "&:hover": !hover ? {} : {transform: "scale(1.01)", boxShadow: 6},
                transition: "transform 0.3s, box-shadow 0.3s",
                boxShadow: 3,
                borderRadius: 2,
                maxWidth: maximumWidth ? maximumWidth : '100%',
                maxHeight: maximumHeight ? maximumHeight : '100%',
                height: height,
            })}
        >
            {children}
        </Box>
    );
}