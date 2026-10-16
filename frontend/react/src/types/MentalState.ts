export type MentalStateGoal = 'LABOR' | 'LEISURE' | 'RECOVERY';

export const MENTAL_STATE_GOAL_LABELS: Record<MentalStateGoal, string> = {
    LABOR: 'Labor',
    LEISURE: 'Leisure',
    RECOVERY: 'Recovery',
};

export function formatMentalStateSummary(state: string, goal: MentalStateGoal): string {
    return `${state} · ${MENTAL_STATE_GOAL_LABELS[goal]}`;
}

export interface MentalStateCheckInRequest {
    goal: MentalStateGoal;
    energy: number;
    activation: number;
    stimulationHunger: number;
    clarity: number;
    valence: number;
    emotionalLoad: number;
}

export interface MentalStateCheckIn {
    id: string;
    recordedAt: string;
    goal: MentalStateGoal;
    state: string;
    suggestedActions: string[];
}
