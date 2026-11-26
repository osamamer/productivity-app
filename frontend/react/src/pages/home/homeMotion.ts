import { keyframes } from '@mui/system';

export const greetingReveal = keyframes`
    from {
        opacity: 0;
        transform: translateX(-32px);
    }
    to {
        opacity: 1;
        transform: translateX(0);
    }
`;

export const focusTaskSlide = keyframes`
    from {
        opacity: 0;
        transform: translateY(var(--focus-task-offset, 0px));
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
`;

export const focusTaskReturn = keyframes`
    from {
        opacity: 1;
        transform: translateY(0);
    }
    to {
        opacity: 0;
        transform: translateY(var(--focus-task-offset, 0px));
    }
`;

export const tasksFadeAway = keyframes`
    from {
        opacity: 1;
    }
    to {
        opacity: 0;
    }
`;

export const tasksFadeBack = keyframes`
    from {
        opacity: 0;
        transform: translateY(7px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
`;

export const buttonFadeIn = keyframes`
    from { opacity: 0; }
    to { opacity: 1; }
`;

export const TASKS_FADE_DURATION_MS = 220;
export const TOTAL_FOCUS_TRANSITION_MS = 380;
export const FOCUS_TASK_SLIDE_DURATION_MS = 520;
export const SELECTION_ACTIONS_EDGE_PADDING = 12;
export const SELECTION_ACTIONS_GAP = 4;
export const SELECTION_ACTIONS_FALLBACK_WIDTH = 136;

export const TASK_EXIT_DURATION_MS = 360;
export const TASK_REORDER_DURATION_MS = 340;
export const TASK_COMPLETION_REORDER_DURATION_MS = 440;
export const TASK_REORDER_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';
export const TASK_COMPLETION_REORDER_EASING = 'cubic-bezier(0.4, 0, 0.2, 1)';
export const EDGE_DROP_ZONE_OUTSIDE_REACH = 72;
export const EDGE_DROP_ZONE_LIST_OVERLAP = 16;
