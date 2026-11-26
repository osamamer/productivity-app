import { keyframes } from '@mui/system';

export const expandDayReveal = keyframes`
    from { clip-path: inset(0 0 100% 0); opacity: 0.7; }
    to { clip-path: inset(0 0 0 0); opacity: 1; }
`;

export const calendarLoadingReveal = keyframes`
    from {
        opacity: 0;
        transform: translate3d(0, 8px, 0);
    }
    to {
        opacity: 1;
        transform: none;
    }
`;
