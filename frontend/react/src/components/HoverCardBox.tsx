import {Box, Card} from "@mui/material";
import React, {ReactElement, ReactNode} from "react";
import {string} from "yup";

interface props {
    children: ReactNode,
    display?: (theme: any) => any; // a function that receives the theme
    maximumWidth?: string;
}

export function HoverCardBox({ children, display, maximumWidth }: props) {
    return (
        <Card
            sx={(theme) => ({
                display: display ? display(theme) : "block", // use the function or fallback
                flexDirection: "column",
                gap: 1,
                px: 2,
                py: 2,
                "&:hover": { transform: "scale(1.01)", boxShadow: 6 },
                transition: "transform 0.3s, box-shadow 0.3s",
                boxShadow: 3,
                borderRadius: 1,
                maxWidth: maximumWidth? maximumWidth : '100%'
            })}
        >
            {children}
        </Card>
    );
}