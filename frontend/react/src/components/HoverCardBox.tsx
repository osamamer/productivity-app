import {Card} from "@mui/material";
import React, {ReactElement, ReactNode} from "react";

interface props {
    children: ReactNode
}
export function HoverCardBox(props: props) {
    return (
        <>
            <Card className="box-shadow box" sx={{
                display: 'flex', gap: 1, px: 2, py: 2, direction: 'column',
                '&:hover': {
                    transform: 'scale(1.02)',
                    boxShadow: 6,
                },
                transition: 'transform 0.3s, box-shadow 0.3s',
                boxShadow: 3,
                borderRadius: 5,
            }}>
                {props.children}
            </Card>
        </>
    );
}