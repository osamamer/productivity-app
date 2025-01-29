import React, {useState, useEffect, useRef} from 'react';
import {Box} from '@mui/material';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import {Task} from "../interfaces/Task.tsx"; // Import styles
type props =
    {
        initialTargetText: string;
        onSubmit: (text: string, taskId: string) => void;
        placeholderText: string;
        task: Task;
    }

const EditableField: React.FC<props> = (props: props) => {
    const [targetText, setTargetText] =
        useState<string>(props.task.description);
    const [isEditing, setIsEditing] =
        useState<boolean>(false);
    const reference = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (reference.current && !targetText.trim()) {
            reference.current.setAttribute('data-placeholder', props.placeholderText);
        } else {
            reference.current?.setAttribute('data-placeholder', '');
        }
    }, [targetText]);
    useEffect(() => {
        setTargetText(props.task.description || ""); // Reset when task changes
    }, [props.task]);


    const handleInput = (event: React.FormEvent<HTMLDivElement>) => {
        setTargetText(event.currentTarget.textContent || '');
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if ((event.key === 'Delete' || event.key === 'Backspace') && !targetText.trim()) {
            reference.current?.setAttribute('data-placeholder', props.placeholderText);
        }
    };

    const handleBlur = () => {
        const trimmedText = targetText.trim();
        setTargetText(trimmedText); // Keep UI updated
        setIsEditing(false);

        if (props.task.taskId) {
            props.onSubmit(trimmedText, props.task.taskId); // Ensure task ID is passed
        }
    };


    const handleFocus = () => {
        setIsEditing(true);
    };


    return (
        <Box
            sx={{
                padding: '8px',
                minHeight: '40px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
            }}
            style={{
                border: 'none',
                textAlign: 'center',
                width: '100%',
                color: 'text.primary',
                fontSize: 'large',
            }}
            className="task-description-container"
        >
            <ReactQuill
                value={targetText}
                onChange={setTargetText}
                placeholder={props.placeholderText}
                onBlur={handleBlur}
                theme="snow"
                modules={{toolbar: false}} // Disable toolbar for simple editing
                style={{
                    border: 'none',
                    textAlign: 'center',
                    width: '100%',
                    color: 'primary.main'
                }}
            />
        </Box>
    );
};

export default EditableField;
