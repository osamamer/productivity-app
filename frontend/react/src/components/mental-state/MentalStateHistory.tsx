import { List, ListItemButton, ListItemText, Paper, Stack, Typography } from '@mui/material';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import { MentalStateCheckIn } from '../../types/MentalState';

interface MentalStateHistoryProps {
    checkIns: MentalStateCheckIn[];
    selectedId: string | null;
    onSelect: (checkIn: MentalStateCheckIn) => void;
}

function formatRecordedAt(recordedAt: string): string {
    const date = new Date(recordedAt);
    const today = new Date();
    const sameDay = date.toDateString() === today.toDateString();
    return sameDay
        ? `Today, ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
        : date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function MentalStateHistory({ checkIns, selectedId, onSelect }: MentalStateHistoryProps) {
    return (
        <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3, overflow: 'hidden', textAlign: 'left' }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2, py: 1.75, borderBottom: 1, borderColor: 'divider' }}>
                <HistoryRoundedIcon color="action" />
                <Typography fontWeight={700}>Recent check-ins</Typography>
            </Stack>
            {checkIns.length === 0 ? (
                <Typography color="text.secondary" variant="body2" sx={{ p: 2.5 }}>
                    No snapshots yet. Your first one will appear here.
                </Typography>
            ) : (
                <List disablePadding sx={{ maxHeight: 440, overflowY: 'auto' }}>
                    {checkIns.map(checkIn => (
                        <ListItemButton
                            key={checkIn.id}
                            selected={checkIn.id === selectedId}
                            onClick={() => onSelect(checkIn)}
                            sx={{ px: 2, py: 1.25, borderBottom: 1, borderColor: 'divider', alignItems: 'flex-start' }}
                        >
                            <ListItemText
                                primary={checkIn.state}
                                secondary={formatRecordedAt(checkIn.recordedAt)}
                                primaryTypographyProps={{ fontWeight: checkIn.id === selectedId ? 700 : 500 }}
                            />
                        </ListItemButton>
                    ))}
                </List>
            )}
        </Paper>
    );
}
