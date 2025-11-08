import {Task} from "../types/Task.tsx";
import {Card, Checkbox, Typography, Box} from "@mui/material";

type props = { task: Task, toggleTaskCompletion: (taskId: string) => void, onClick?: (task: Task) => void };

const formatTime = (dateTime: string): string => {
    const date = new Date(dateTime);
    const now = new Date();

    // Reset times for accurate day comparison
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const taskDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Check if same day
    if (taskDate.getTime() === today.getTime()) return "Today";
    if (taskDate.getTime() === tomorrow.getTime()) return "Tomorrow";
    if (taskDate.getTime() === yesterday.getTime()) return "Yesterday";

    // Within a week (future or past)
    const daysDiff = Math.floor((taskDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (Math.abs(daysDiff) <= 7) {
        const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        return dayNames[date.getDay()];
    }

    // Different year - show full date with year
    if (date.getFullYear() !== now.getFullYear()) {
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    }

    // Same year but far away - show month and day with ordinal
    const day = date.getDate();
    const ordinal = (day: number) => {
        if (day > 3 && day < 21) return 'th';
        switch (day % 10) {
            case 1: return 'st';
            case 2: return 'nd';
            case 3: return 'rd';
            default: return 'th';
        }
    };

    const monthName = date.toLocaleDateString('en-US', { month: 'short' });
    return `${monthName} ${day}${ordinal(day)}`;
};

const isOverdue = (dateTime: string): boolean => {
    const date = new Date(dateTime);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const taskDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    return taskDate.getTime() < today.getTime();
};

export function TaskDiv(props: props) {
    const importance = props.task.importance;
    const overdue = isOverdue(props.task.scheduledPerformDateTime) && !props.task.completed;

    // Checkbox color based on priority
    const getCheckboxColor = () => {
        if (importance > 7) return '#ef4444'; // Red for high
        if (importance > 4) return '#eab308'; // Yellow for medium
        return '#1976d2'; // Blue for low
    };

    // Date text color
    const getDateColor = () => {
        if (overdue) return '#ef4444'; // Red for overdue
        return '#1976d2'; // Blue for today/future
    };

    return (
        <Card
            className="task-div"
            sx={{
                '&:hover': {
                    transform: 'scale(1.03)',
                    boxShadow: 6,
                },
                transition: 'transform 0.3s, box-shadow 0.3s',
                boxShadow: 3,
                borderRadius: 2,
                position: 'relative', // For absolute positioning of date
            }}
            onClick={() => props.onClick ? props.onClick(props.task) : {}}
        >
            <Box sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                pr: 10, // Add padding to prevent overlap with date
            }}>
                <Checkbox
                    size="small"
                    checked={props.task.completed}
                    onChange={() => props.toggleTaskCompletion(props.task.taskId)}
                    sx={{
                        color: getCheckboxColor(),
                        '&.Mui-checked': {
                            color: getCheckboxColor(),
                        },
                    }}
                />
                <Typography
                    sx={{
                        color: props.task.completed ? "gray" : "inherit",
                        textDecoration: props.task.completed ? "line-through" : "none",
                        display: "-webkit-box",
                        overflow: "hidden",
                        WebkitBoxOrient: "vertical",
                        WebkitLineClamp: 4,
                        lineHeight: 1.4,
                        maxHeight: "5.6em",
                        flex: 1,
                    }}
                >
                    {props.task.name}
                </Typography>
            </Box>
            {!props.task.parentId && (
                <Typography
                    sx={{
                        position: 'absolute',
                        top: '50%',
                        right: 12,
                        transform: 'translateY(-50%)',
                        color: getDateColor(),
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                    }}
                >
                    {formatTime(props.task.scheduledPerformDateTime)}
                </Typography>
            )}

        </Card>
    );
}