import { AttentionState, ClosureType } from '../../types/MentalThread.ts';

export const attentionStateDetails: Record<AttentionState, {
    label: string;
    description: string;
    color: string;
}> = {
    ACTING: {
        label: 'Acting',
        description: 'You are taking action to move this forward.',
        color: '#3478F6',
    },
    RUMINATING: {
        label: 'Ruminating',
        description: 'It keeps resurfacing, but you are not acting on it.',
        color: '#D14343',
    },
    PLANNED: {
        label: 'Planned',
        description: 'It has a next step or a deliberate review point.',
        color: '#2F9D74',
    },
    PENDING: {
        label: 'Pending',
        description: 'It depends on another person or an external event.',
        color: '#D98B2B',
    },
};

export const attentionStates = Object.keys(attentionStateDetails) as AttentionState[];

export const closureTypeLabels: Record<ClosureType, string> = {
    RESOLVED: 'Resolved',
    ACCEPTED: 'Accepted',
    RELEASED: 'Released',
};
