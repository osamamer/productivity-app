import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import HourglassEmptyRoundedIcon from '@mui/icons-material/HourglassEmptyRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { CalendarEventStatus } from '../../types/CalendarEvent';

export function EventStatusIcon({ status }: { status: CalendarEventStatus }) {
    if (status === 'TENTATIVE') return <HourglassEmptyRoundedIcon fontSize="small" />;
    if (status === 'CANCELLED') return <CloseRoundedIcon fontSize="small" />;
    return <CheckRoundedIcon fontSize="small" />;
}
