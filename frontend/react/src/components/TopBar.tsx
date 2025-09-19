import {AppBar, Box, Button, IconButton, TextField, Toolbar, Typography} from "@mui/material";
import NightlightIcon from '@mui/icons-material/Nightlight';
import ChatIcon from '@mui/icons-material/Chat';
import {useNavigate} from "react-router-dom";
import React from "react";
import {TaskToCreate} from "../interfaces/TaskToCreate.tsx";

type props = {onSubmit: (taskToCreate: TaskToCreate) => void,
            darkModeFunction: (darkMode: boolean) => void,
            darkMode: boolean};

export function TopBar(props: props) {
    // const {toggleTheme, isDarkMode} = useContext(ThemeContext);
    const navigate = useNavigate();
    const handleFeedbackClick = () => {
        navigate('/feedback');
    }
    const handleLogoutClick = () => {
        navigate('/login');
    }
    const [newTask, setNewTask] = React.useState("");
    function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (newTask === "") return
        console.log(newTask)
        const taskToCreate: TaskToCreate = {
            name: newTask.valueOf(),
            description: "",
            scheduledPerformDateTime: "",
            tag: "",
            importance: 0};
        props.onSubmit(taskToCreate);
        setNewTask("");
    }
    return (
        <>
            {/*<Box style={{zIndex: 1400, position: 'static', marginBottom: 10, pl: 0}}>*/}
            <AppBar  sx={{padding: 0, backgroundColor: "background.default"}} className="appbar">
                <Toolbar sx={{display: 'flex', padding: 0, justifyContent: 'space-between'}} className="appbar">
                    {/*<Box sx={{*/}
                    {/*    display: 'flex', alignItems: 'center', flexGrow: 1,*/}
                    {/*    flexBasis: 0*/}
                    {/*}}>*/}
                    {/*    /!*<img src={logo} alt="logo" className="logo"/>*!/*/}
                    {/*</Box>*/}

                    <Typography
                        color="text.primary"
                        sx={{ mr: 2}}
                        variant="h5" component="div">
                        What's on your mind?
                    </Typography>
                    <Box component="form" onSubmit={handleSubmit} sx={{ padding: 2 }}>
                        <TextField
                            value={newTask}
                            onChange={(e) => setNewTask(e.target.value)}
                            placeholder="Add task..."
                            variant="standard"
                            fullWidth
                        />
                    </Box>
                    <Box sx={{
                        display: 'flex', justifyContent: 'flex-end', gap: 1, flexGrow: 1,
                        flexBasis: 0
                    }}>
                        <IconButton onClick={() => {props.darkModeFunction(props.darkMode)}}>
                            <NightlightIcon></NightlightIcon>
                        </IconButton>
                        <Button
                            variant="outlined"
                            onClick={handleFeedbackClick}
                            startIcon={<ChatIcon/>}
                        >
                            Feedback
                        </Button>

                        <Button sx={{
                            color: 'text.primary',
                            '&:hover': {
                                color: theme => theme.palette.high.main
                            },
                        }} color="inherit" onClick={handleLogoutClick}>Log out</Button>
                    </Box>
                </Toolbar>
            </AppBar>
            {/*</Box>*/}
        </>
    )
}