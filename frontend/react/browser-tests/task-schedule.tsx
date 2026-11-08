import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Box, Stack, Typography } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { TaskSchedulePicker } from '../src/components/task/TaskSchedulePicker';
import { TaskSeriesTimeField } from '../src/components/task/TaskSeriesTimeField';

export function TaskScheduleFixture() {
    const initialSchedule = new Date(2026, 9, 26, 9, 0);
    const [scheduleDraft, setScheduleDraft] = useState<Date | null>(initialSchedule);
    const [savedSchedule, setSavedSchedule] = useState<Date | null>(initialSchedule);
    const [scheduleSaveCount, setScheduleSaveCount] = useState(0);
    const [savedSeriesTime, setSavedSeriesTime] = useState('09:00');

    const formatTime = (value: Date | null) => value
        ? `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`
        : '';

    return (
        <LocalizationProvider dateAdapter={AdapterDateFns}>
            <Stack spacing={3} sx={{ p: 3, maxWidth: 420 }}>
                <Box>
                    <TaskSchedulePicker
                        label="Schedule"
                        value={scheduleDraft}
                        savedValue={savedSchedule}
                        timeOnly
                        onChange={setScheduleDraft}
                        onAccept={date => {
                            setSavedSchedule(date);
                            setScheduleSaveCount(count => count + 1);
                        }}
                    />
                    <Typography data-testid="saved-schedule">Saved: {formatTime(savedSchedule)}</Typography>
                    <Typography data-testid="schedule-save-count">Saves: {scheduleSaveCount}</Typography>
                </Box>
                <Box>
                    <TaskSeriesTimeField
                        startDateTime="2026-10-26T09:00:00"
                        onApply={async time => setSavedSeriesTime(time)}
                    />
                    <Typography data-testid="saved-series-time">Series: {savedSeriesTime}</Typography>
                </Box>
            </Stack>
        </LocalizationProvider>
    );
}

createRoot(document.getElementById('root')!).render(<TaskScheduleFixture />);
