import React from 'react';
import {ListItem, ListItemButton, ListItemIcon, ListItemText} from '@mui/material';
import { useNavigate } from 'react-router-dom';
type props = {
    image: string,
    text: string,
    targetPage: string,
    open: boolean
}
export function SideMenuButton(props: props) {
    const navigate = useNavigate();

    const handleNavigation = () => {
        navigate(props.targetPage);
    };

    return (
        <>
            <ListItemButton sx={{
                minHeight: 24,
                justifyContent: open ? 'initial' : 'center',
                // justifyContent: 'center',
                borderBottom: 0.5,
                py: 2
            }} onClick={handleNavigation}>
                <ListItemIcon
                    sx={{
                        height: 30,
                        width: 30,
                        mr: open ? 3 : 'auto',
                        justifyContent: 'center',
                        // backgroundColor: 'red',
                        // opacity: 0.8,
                        // p: 5
                    }}

                    variant="outlined">
                    <img src={props.image} alt="icon" className="logo icon" />
                </ListItemIcon>
                <ListItemText primary={props.text} sx={{ display: { sm: 'none', lg: 'block'}, opacity: open ? 1 : 0 }} />
            </ListItemButton></>
    );
}