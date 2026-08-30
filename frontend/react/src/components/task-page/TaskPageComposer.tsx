import React from 'react';
import { Box, Typography } from '@mui/material';
import { SmartTaskInput } from '../input/SmartTaskInput.tsx';
import { TaskToCreate } from '../../types/TaskToCreate.tsx';

type TaskPageComposerProps = {
    onCreateTask: (task: TaskToCreate) => Promise<void>;
};

export const TaskPageComposer = React.memo(function TaskPageComposer({ onCreateTask }: TaskPageComposerProps) {
    return (
        <Box
            sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'minmax(max-content, 0.42fr) minmax(0, 1fr)' },
                alignItems: 'center',
                gap: { xs: 1.5, sm: 4 },
                mb: 5,
            }}
        >
            <Typography
                variant="h4"
                color="text.secondary"
                component="h1"
                sx={{ fontWeight: 400, textAlign: 'left' }}
            >
                All your tasks
            </Typography>

            <Box
                sx={{
                    backgroundColor: 'background.paper',
                    borderRadius: 3,
                    px: 2.5,
                    py: 1.5,
                    boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
                    '& .MuiInput-underline:before': { borderBottom: 'none' },
                    '& .MuiInput-underline:after': { borderBottom: 'none' },
                    '& .MuiInput-underline:hover:not(.Mui-disabled):before': { borderBottom: 'none' },
                    '& .MuiInput-root': { fontSize: '1.1rem' },
                }}
            >
                <SmartTaskInput onSubmit={onCreateTask} placeholder="Add a task..." />
            </Box>
        </Box>
    );
});
