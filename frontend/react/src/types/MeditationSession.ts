export interface MeditationSession {
    id: string;
    running: boolean;
    active: boolean;
    totalSessionTime: string | number | [number, number] | null;
    startTime: string | null;
    lastUnpauseTime: string | null;
    lastPauseTime: string | null;
    endTime: string | null;
    moodBefore: number;
    moodAfter: number;
    numIntervalBells: number;
    intendedLength: number;
}

export interface StartMeditationRequest {
    mood: number;
    numIntervalBells: number;
    intendedLength: number;
}
