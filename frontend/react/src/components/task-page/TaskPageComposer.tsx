import React from 'react';
import { Box, IconButton, InputAdornment, TextField, Typography } from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { SmartTaskInput } from '../input/SmartTaskInput.tsx';
import { TaskToCreate } from '../../types/TaskToCreate.tsx';

type TaskPageComposerProps = {
    onCreateTask: (task: TaskToCreate) => Promise<void>;
    searchQuery: string;
    onSearchChange: (query: string) => void;
};

export const TaskPageComposer = React.memo(function TaskPageComposer({
    onCreateTask,
    searchQuery,
    onSearchChange,
}: TaskPageComposerProps) {
    const [searchMode, setSearchMode] = React.useState(false);

    const closeSearch = () => {
        setSearchMode(false);
        onSearchChange('');
    };

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
                {searchMode ? (
                    <TextField
                        data-task-search="true"
                        value={searchQuery}
                        onChange={event => onSearchChange(event.target.value)}
                        onKeyDown={event => {
                            if (event.key === 'Escape') closeSearch();
                        }}
                        placeholder="Search tasks"
                        aria-label="Search tasks"
                        type="search"
                        variant="standard"
                        autoFocus
                        fullWidth
                        autoComplete="off"
                        slotProps={{
                            input: {
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchRoundedIcon sx={{ fontSize: 19 }} />
                                    </InputAdornment>
                                ),
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton
                                            data-task-search="true"
                                            size="small"
                                            aria-label="Close task search"
                                            onClick={closeSearch}
                                            edge="end"
                                        >
                                            <CloseRoundedIcon fontSize="small" />
                                        </IconButton>
                                    </InputAdornment>
                                ),
                            },
                        }}
                    />
                ) : (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                            <SmartTaskInput onSubmit={onCreateTask} placeholder="Add a task..." />
                        </Box>
                        <IconButton
                            data-task-search="true"
                            size="small"
                            aria-label="Search tasks"
                            onClick={() => setSearchMode(true)}
                            sx={{ flexShrink: 0 }}
                        >
                            <SearchRoundedIcon fontSize="small" />
                        </IconButton>
                    </Box>
                )}
            </Box>
        </Box>
    );
});
