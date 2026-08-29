export interface MentalStateCheckInRequest {
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
    state: string;
    suggestedActions: string[];
}
