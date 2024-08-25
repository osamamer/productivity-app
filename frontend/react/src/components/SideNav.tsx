import {
    Box,
    Drawer,
    IconButton,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Menu,
    useMediaQuery,
    useTheme
} from "@mui/material";
import {Home, Info, Settings} from "@mui/icons-material";
import {useState} from "react";
import home from '../assets/images/home.png';
import clipboard from '../assets/images/clipboard.png';
import day from '../assets/images/day.png';
import calender from '../assets/images/calendar.png';
import meditation from '../assets/images/yoga.png'
import stats from '../assets/images/stats.png';
import settings from '../assets/images/settings.png';

import device from '../assets/images/storage-device.png';
import {SideMenuButton} from "./SideMenuButton.jsx";
import {Task} from "../interfaces/Task.tsx";
type props = {
    onSidebarWidthChange: (number) => void;
    openProp: boolean;
};
export function SideNav(props: props) {
    const theme = useTheme();
    const [open, setOpen] = useState(props.openProp);
    const handleMouseEnter = () => {
        setOpen(true);
        props.onSidebarWidthChange(240);
    };

    // Function to handle mouse leave (close the drawer)
    const handleMouseLeave = () => {
        setOpen(false);
        props.onSidebarWidthChange(75);

    };
    return (
        <Drawer
            variant="permanent"
            anchor="left"
            open={open}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            elevation={24}
            sx={{
                position: 'fixed',
                zIndex: 1000,
                width: open ? 240 : 75,
                '& .MuiDrawer-paper': {
                    width: open ? 240 : 75,
                    overflowX: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    transition: 'width 0.3s ease',
                },
                borderRight: 0.5
            }}
        >
            <List sx={{width: '100%', textAlign: 'center', mt: 8}}>
                <SideMenuButton image={home as string} text="Home" targetPage="/" open={open}></SideMenuButton>
                <SideMenuButton image={clipboard as string} text="Tasks" targetPage="/tasks" open={open}></SideMenuButton>
                <SideMenuButton image={day as string} text="Day" targetPage="/day" open={open}></SideMenuButton>
                <SideMenuButton image={calender as string} text="Calender" targetPage="/calender" open={open}></SideMenuButton>
                <SideMenuButton image={meditation as string} text="Meditation" targetPage="/meditation" open={open}></SideMenuButton>
                <SideMenuButton image={stats as string} text={"Statistics"} targetPage={"/statistics"} open={open}></SideMenuButton>
                <SideMenuButton image={settings as string} text={"Settings"} targetPage={"/settings"} open={open}></SideMenuButton>
            </List>
        </Drawer>
    );
}