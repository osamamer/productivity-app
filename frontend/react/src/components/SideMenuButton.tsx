import React from 'react';
import { ListItemButton, ListItemIcon, ListItemText } from '@mui/material';
import { useNavigate } from 'react-router-dom';

type props = {
    image: string,
    text: string,
    targetPage: string,
    open: boolean,
    darkMode: boolean,
}

export function SideMenuButton(props: props) {
    const navigate = useNavigate();

    const handleNavigation = () => {
        navigate(props.targetPage);
    };

    return (
        <ListItemButton
            sx={{
                minHeight: 48, // Ensure enough height for vertical alignment
                justifyContent: props.open ? 'initial' : 'center',
                borderBottom: 0.5,
                py: 2,
                alignItems: 'center',
            }}
            onClick={handleNavigation}
        >
            <ListItemIcon
                sx={{
                    height: 30,
                    width: 30,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    mr: props.open ? 3 : 0,
                }}
            >
                <img
                    src={props.image}
                    alt="icon"
                    style={{
                        height: 'auto', // Maintain the aspect ratio
                        width: '100%',  // Ensure the width fits the container
                        maxHeight: '100%', // Prevent the image from exceeding the container's height
                        objectFit: 'contain', // Prevent stretching by containing the image within the bounds
                        filter: props.darkMode
                            ? 'brightness(0) invert(1)'  // Light icon on dark background
                            : 'brightness(0) invert(0)', // Dark icon on light background
                    }}
                    className="logo icon"
                />
            </ListItemIcon>
            <ListItemText
                primary={props.text}
                sx={{
                    display: { sm: 'none', lg: 'block' },
                    opacity: props.open ? 1 : 0,
                    transition: 'opacity 0.3s ease',
                }}
            />
        </ListItemButton>
    );
}
