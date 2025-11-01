import React, {useState, useEffect, useRef} from 'react';
import {Box} from '@mui/material';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import {Task} from "../../types/Task.tsx"; // Import styles
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
        if (props.taskId) {
            props.onSubmit(trimmedText, props.taskId);
        }
    };


    const handleFocus = () => {
        setIsEditing(true);
    };


    return (
        <Box
            sx={{
                '& .ql-container': {
                    border: 'none !important',   // removes the outer border
                },
                '& .ql-editor': {
                    fontSize: '20px',
                    textAlign: 'center',
                    color: 'white',              // main text color
                    minHeight: '40px',
                    '&.ql-blank::before': {
                        color: 'rgba(255, 255, 255, 0.5)', // placeholder gray-white
                        fontStyle: 'italic',
                        textAlign: 'center',
                    },
                },
            }}
        >
            <ReactQuill
                value={targetText}
                onChange={setTargetText}
                placeholder={PLACEHOLDER}
                onBlur={handleBlur}
                theme="snow"
                modules={{ toolbar: false }}
            />
        </Box>

    );
};

export default EditableField;
