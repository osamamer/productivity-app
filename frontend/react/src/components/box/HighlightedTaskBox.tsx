import React, {useCallback, useEffect, useMemo, useState} from "react";
import {Task} from "../../types/Task.tsx";
import {Box, Card, DialogContent, styled, Typography} from "@mui/material";
import Button from "@mui/material/Button";
import CheckIcon from '@mui/icons-material/Check';
import AdjustIcon from '@mui/icons-material/Adjust';
import EditableField from "../input/EditableField.tsx";
import {HoverCardBox} from "./HoverCardBox";
import PomodoroTimer from "../PomodoroTimer";
import DensityMediumRoundedIcon from '@mui/icons-material/DensityMediumRounded';
import List from '@mui/material/List';
import {SmartTaskInput} from "../input/SmartTaskInput.tsx";
import { TaskToCreate } from "../../types/TaskToCreate.tsx";
import {taskService} from "../../services/api";
import IconButton from '@mui/material/IconButton';
import {TaskDiv} from "../TaskDiv.tsx";

type props = {
    tasks: Task[];
    task: Task | null;
    handleOpenDialog?: (dialogType: string) => void;
    handleChangeDescription: (description: string, taskId: string) => void;
    toggleTaskCompletion: (taskId: string) => void,
};

export function HighlightedTaskBox(props: props) {
    const [showPomodoro, setShowPomodoro] = useState(false);
    const [subTasks, setSubTasks] = useState<Task[]>([]);
    const [showSubtasks, setShowSubtasks] = useState(false);

    if (!props.task) return null;
    const importance = useMemo(() => {
        if (!props.task || props.task.importance <= 3) return "low";
        if (props.task.importance <= 7) return "medium";
        return "high";
    }, [props.task]);


    const handleSubtaskClick = useCallback(() => {
        setShowSubtasks(prev => !prev);
    }, []);



    const getSubtasks = useCallback(async (taskId: string) => {
        try {
            const subtasks = await taskService.getSubtasks(taskId);
            setSubTasks(subtasks);
        } catch (err) {
            console.error('Error fetching subtasks for highlighted task:', err);
            setSubTasks([]);
        }
    }, []);

    const createTask = useCallback(async (task: TaskToCreate) => {
        try {
            await taskService.createTask(task);

            // Just refetch subtasks after creation
            if (props.task?.taskId) {
                await getSubtasks(props.task.taskId);
            }
        } catch (err) {
            console.error('Error creating subtask:', err);
        }
    }, [props.task?.taskId, getSubtasks]);

    const handleSubtaskToggle = useCallback(async (taskId: string) => {
        // Optimistic update of local subtasks
        setSubTasks(prev =>
            prev.map(t =>
                t.taskId === taskId ? { ...t, completed: !t.completed } : t
            )
        );

        // Call the parent's toggle function
        await props.toggleTaskCompletion(taskId);
    }, [props.toggleTaskCompletion]);

    useEffect(() => {
        if (props.task?.taskId) {
            getSubtasks(props.task?.taskId);
        }
    }, [props.task.taskId, getSubtasks]);

    // Auto-show/hide subtasks based on if they exist
    useEffect(() => {
        setShowSubtasks(subTasks.length > 0);
    }, [subTasks.length]); // Changed to only depend on length

    return (
        <HoverCardBox>
            <Box sx={{display: 'flex', flexDirection: 'row', justifyContent: 'space-between'}}>
                <Typography variant="h5" sx={{mb: 0}}>
                    {props.task.name ?? "No task to highlight"}
                </Typography>
                <IconButton onClick={handleSubtaskClick}>
                    <DensityMediumRoundedIcon/>
                </IconButton>
            </Box>

            <EditableField
                onSubmit={props.handleChangeDescription}
                description={props.task.description}
                taskId={props.task.taskId}
            />

            {showSubtasks && (
                <Box sx={{mb: 4}}>
                    <List>
                        {subTasks.map((subtask: Task) => (
                            <TaskDiv
                                key={subtask.taskId}
                                task={subtask}
                                toggleTaskCompletion={handleSubtaskToggle}
                            />
                        ))}
                    </List>
                    <SmartTaskInput onSubmit={createTask} parentId={props.task.taskId}/>
                </Box>
            )}
            <Box sx={{display: 'flex', justifyContent: 'center'}}>
                <IconButton color={importance as any}>
                    <AdjustIcon onClick={() => setShowPomodoro(!showPomodoro)}/>
                </IconButton>

            </Box>

            {showPomodoro && <PomodoroTimer task={props.task}/>}
        </HoverCardBox>
    );
}

