import React, {useState, useEffect, useRef} from 'react';
import {Box} from '@mui/material';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import {Task} from "../interfaces/Task.tsx"; // Import styles
type props =
    {
        onSubmit: (text: string, taskId: string) => void;
        description: string;
        taskId: string;
    }

const EditableField: React.FC<props> = (props: props) => {
    const [targetText, setTargetText] =
        useState<string>(props.description);
    const [isEditing, setIsEditing] =
        useState<boolean>(false);
    const reference = useRef<HTMLDivElement>(null);
    const PLACEHOLDER = "Describe this task...";
    useEffect(() => {
        if (reference.current && !targetText.trim()) {
            reference.current.setAttribute('data-placeholder', PLACEHOLDER);
        } else {
            reference.current?.setAttribute('data-placeholder', '');
        }
    }, [targetText]);
    useEffect(() => {
        setTargetText(props.description || ""); // Reset when task changes
    }, [props.description]);
    useEffect(() => {
        setTargetText(props.description || "");
    }, [props.description]);


    const handleInput = (event: React.FormEvent<HTMLDivElement>) => {
        setTargetText(event.currentTarget.textContent || '');
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if ((event.key === 'Delete' || event.key === 'Backspace') && !targetText.trim()) {
            reference.current?.setAttribute('data-placeholder', PLACEHOLDER);
        }
    };

    const handleBlur = () => {
        const trimmedText = targetText.trim();
        setTargetText(trimmedText); // Keep UI updated
        setIsEditing(false);
        console.log("ayo")
        if (props.taskId) {
            console.log("ayoo")
            console.log(trimmedText)
            console.log(props.taskId)

            props.onSubmit(trimmedText, props.taskId); // Ensure task ID is passed
        }
    };


    const handleFocus = () => {
        setIsEditing(true);
    };


    return (
        <Box sx={{
            '& .ql-editor': {
                fontSize: '20px',
                textAlign: 'center',
                border: 'none'
            }
        }}
            // sx={{
            //     padding: '8px',
            //     minHeight: '40px',
            //     display: 'flex',
            //     justifyContent: 'center',
            //     alignItems: 'center',
            // }}
            style={{
                border: 'none',
                textAlign: 'center',
                width: '100%',
                color: 'text.primary',
                fontSize: 'large',
            }}
            className="task-props.description-container"
        >
            <ReactQuill
                value={targetText}
                onChange={setTargetText}
                placeholder={PLACEHOLDER}
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
