import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Task } from "../../types/Task.tsx";
import { alpha, Box, Typography } from "@mui/material";
import AdjustIcon from '@mui/icons-material/Adjust';
import EditableField from "../input/EditableField.tsx";
import PomodoroTimer from "../timer/PomodoroTimer.tsx";
import DensityMediumRoundedIcon from '@mui/icons-material/DensityMediumRounded';
import List from '@mui/material/List';
import { SmartTaskInput } from "../input/SmartTaskInput.tsx";
import { TaskToCreate } from "../../types/TaskToCreate.tsx";
import { taskService } from "../../services/api";
import IconButton from '@mui/material/IconButton';
import { TaskDiv } from "../TaskDiv.tsx";

type props = {
    tasks: Task[];
    task: Task | null;
    label?: string;
    handleOpenDialog?: (dialogType: string) => void;
    handleChangeDescription: (description: string, taskId: string) => void;
    toggleTaskCompletion: (taskId: string) => void;
};

export function HighlightedTaskBox(props: props) {
    const [showPomodoro, setShowPomodoro] = useState(false);
    const [isPomodoroRunning, setIsPomodoroRunning] = useState(false);
    const [subTasks, setSubTasks] = useState<Task[]>([]);
    const [showSubtasks, setShowSubtasks] = useState(false);

    // All hooks must be declared before any early return (Rules of Hooks).
    const importance = useMemo(() => {
        if (!props.task || props.task.importance <= 3) return "low";
        if (props.task.importance <= 7) return "medium";
        return "high";
    }, [props.task]);

    // Map semantic importance to a known MUI color token.
    const importanceColor =
        importance === 'high' ? 'error' :
        importance === 'medium' ? 'warning' :
        'primary';

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
            if (props.task?.taskId) {
                await getSubtasks(props.task.taskId);
            }
        } catch (err) {
            console.error('Error creating subtask:', err);
        }
    }, [props.task?.taskId, getSubtasks]);

    const { toggleTaskCompletion } = props;
    const handleSubtaskToggle = useCallback(async (taskId: string) => {
        setSubTasks(prev =>
            prev.map(t =>
                t.taskId === taskId ? { ...t, completed: !t.completed } : t
            )
        );
        await toggleTaskCompletion(taskId);
    }, [toggleTaskCompletion]);

    useEffect(() => {
        if (props.task?.taskId) {
            getSubtasks(props.task.taskId);
        }
    }, [props.task?.taskId, getSubtasks]);

    useEffect(() => {
        setShowSubtasks(subTasks.length > 0);
    }, [subTasks.length]);

    const lightPurple = '#ce93d8';

    if (!props.task) return null;

    return (
        <Box
            sx={{
                borderLeft: `2px solid ${isPomodoroRunning ? alpha(lightPurple, 0.8) : alpha(lightPurple, 0)}`,
                pl: 2,
                transition: 'border-color 0.3s',
            }}
        >
        <Box>
            {props.label && (
                <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 0.5, lineHeight: 1 }}>
                    {props.label}
                </Typography>
            )}
            <Box sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between' }}>
                <Typography variant="h5" sx={{ mb: 0 }}>
                    {props.task.name ?? "No task to highlight"}
                </Typography>
                <IconButton onClick={handleSubtaskClick}>
                    <DensityMediumRoundedIcon />
                </IconButton>
            </Box>

            <EditableField
                onSubmit={props.handleChangeDescription}
                description={props.task.description}
                taskId={props.task.taskId}
            />

            {showSubtasks && (
                <Box sx={{ mb: 4 }}>
                    <List>
                        {subTasks.map((subtask: Task) => (
                            <TaskDiv
                                key={subtask.taskId}
                                task={subtask}
                                toggleTaskCompletion={handleSubtaskToggle}
                            />
                        ))}
                    </List>
                    <SmartTaskInput onSubmit={createTask} parentId={props.task.taskId} />
                </Box>
            )}

            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                <IconButton color={importanceColor}>
                    <AdjustIcon onClick={() => setShowPomodoro(!showPomodoro)} />
                </IconButton>
            </Box>

            {showPomodoro && (
                <PomodoroTimer task={props.task} onActiveChange={setIsPomodoroRunning} />
            )}
        </Box>
        </Box>
    );
}
