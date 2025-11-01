import React, { useState, useEffect } from 'react';
import { Box, Card } from '@mui/material';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { useAppTheme } from '../contexts/ThemeContext';

type DayInfoDivProps = {
    type: 'plan' | 'summary';
    image: string;
    info?: string;
    onSubmit: (value: string) => void;
};

export function DayInfoDiv({ type, image, info, onSubmit }: DayInfoDivProps) {
    const darkMode = useAppTheme();
    const [content, setContent] = useState<string>(info || '');
    const PLACEHOLDER = `Write a ${type} for today...`;

    // Update local state when prop changes (e.g., after refresh)
    useEffect(() => {
        setContent(info || '');
    }, [info]);

    const handleBlur = () => {
        const trimmedContent = content.trim();
        // Only submit if content changed
        if (trimmedContent !== (info || '').trim()) {
            onSubmit(trimmedContent);
        }
    };

    return (
        <Card
            title={`Today's ${type}`}
            sx={{
                '&:hover': {
                    transform: 'scale(1.02)',
                    boxShadow: 6,
                },
                transition: 'transform 0.3s, box-shadow 0.3s',
                boxShadow: 3,
                borderRadius: 3,
                display: 'flex',
                alignItems: 'center',
                p: 1,
                gap: 1,
            }}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                <img
                    className="logo icon"
                    src={image}
                    alt={type}
                    style={{
                        width: '24px',
                        height: '24px',
                        filter: darkMode
                            ? 'brightness(0) invert(1)'
                            : 'brightness(0) invert(0)',
                    }}
                />
            </Box>

            <Box
                sx={{
                    flex: 1,
                    '& .ql-container': {
                        border: 'none !important',
                    },
                    '& .ql-editor': {
                        fontSize: '14px',
                        color: darkMode ? 'white' : 'inherit',
                        minHeight: '40px',
                        padding: '8px 0',
                        '&.ql-blank::before': {
                            color: darkMode
                                ? 'rgba(255, 255, 255, 0.5)'
                                : 'rgba(0, 0, 0, 0.4)',
                            fontStyle: 'italic',
                            left: '0',
                        },
                    },
                    '& .ql-editor p': {
                        margin: 0,
                    },
                }}
            >
                <ReactQuill
                    value={content}
                    onChange={setContent}
                    placeholder={PLACEHOLDER}
                    onBlur={handleBlur}
                    theme="snow"
                    modules={{ toolbar: false }}
                />
            </Box>
        </Card>
    );
}