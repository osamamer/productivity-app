import {AppBar, Box, Button, IconButton, TextField, Toolbar, Typography} from "@mui/material";
import NightlightIcon from '@mui/icons-material/Nightlight';
import ChatIcon from '@mui/icons-material/Chat';
import {useNavigate} from "react-router-dom";
import React from "react";
import {TaskToCreate} from "../types/TaskToCreate.tsx";
import { UserMenu } from "./UserMenu";

type props = {onSubmit: (taskToCreate: TaskToCreate) => void,
    darkModeFunction: (darkMode: boolean) => void,
    darkMode: boolean};

export function TopBar(props: props) {
    const navigate = useNavigate();
    const handleFeedbackClick = () => {
        navigate('/feedback');
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
            <AppBar  sx={{padding: 0}} className="appbar">
                <Toolbar sx={{display: 'flex', padding: 0, justifyContent: 'space-between'}} className="appbar">
                    <Typography
                        color="text.primary"
                        sx={{ mr: 2}}
                        variant="h5" component="div">
                        What's on your mind?
                    </Typography>
                    <form onSubmit={handleSubmit} style={{display: 'flex', alignItems: 'center', flexGrow: 1}}>
                        <TextField
                            value={newTask}
                            onChange={(e) => setNewTask(e.target.value)}
                            id="standard-basic"
                            placeholder="Create task..."
                            variant="standard"
                            sx={{
                                flexGrow: 1,
                                marginRight: 2,
                                '& .MuiInputBase-input': {
                                    fontSize: '1.25rem',
                                },
                            }}
                        />
                    </form>
                    <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                        <IconButton onClick={handleFeedbackClick}>
                            <ChatIcon/>
                        </IconButton>
                        <IconButton onClick={() => props.darkModeFunction(!props.darkMode)}>
                            <NightlightIcon/>
                        </IconButton>
                        <UserMenu />
                    </Box>
                </Toolbar>
            </AppBar>
        </>
    );
}