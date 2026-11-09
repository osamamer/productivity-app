import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Button, Stack, Typography } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { MentalThreadCreateDialog } from '../src/components/mental-threads/MentalThreadCreateDialog';

export function MentalThreadCreateFixture() {
    const [open, setOpen] = useState(false);
    const [createdCount, setCreatedCount] = useState(0);

    return (
        <LocalizationProvider dateAdapter={AdapterDateFns}>
            <Stack spacing={2} sx={{ p: 3 }}>
                <Button onClick={() => setOpen(true)}>New thread</Button>
                <Typography data-testid="created-count">Created: {createdCount}</Typography>
                <MentalThreadCreateDialog
                    open={open}
                    onClose={() => setOpen(false)}
                    onSave={async () => {
                        setCreatedCount(count => count + 1);
                        return true;
                    }}
                />
            </Stack>
        </LocalizationProvider>
    );
}

createRoot(document.getElementById('root')!).render(<MentalThreadCreateFixture />);
