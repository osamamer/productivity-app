export type AttentionState = 'ACTING' | 'RUMINATING' | 'PLANNED' | 'PENDING';
export type MentalThreadStatus = 'OPEN' | 'CLOSED';
export type ClosureType = 'RESOLVED' | 'ACCEPTED' | 'RELEASED';

export interface MentalThread {
    id: string;
    title: string;
    description: string | null;
    status: MentalThreadStatus;
    attentionState: AttentionState;
    desiredResolution: string | null;
    closureType: ClosureType | null;
    resolutionSummary: string | null;
    openedAt: string;
    targetCloseDate: string | null;
    hardDeadlineDate: string | null;
    nextReviewDate: string | null;
    closedAt: string | null;
    currentMentalLoad: number;
    createdAt: string;
    updatedAt: string;
}

export interface MentalThreadInput {
    title: string;
    description: string | null;
    attentionState: AttentionState;
    desiredResolution: string | null;
    targetCloseDate: string | null;
    hardDeadlineDate: string | null;
    nextReviewDate: string | null;
    currentMentalLoad: number;
    loadReason: string | null;
}

export interface MentalThreadLoadEntry {
    id: string;
    load: number;
    reason: string | null;
    recordedAt: string;
}

export interface MentalThreadSummary {
    openThreadCount: number;
    totalLoad: number;
    highLoadCount: number;
    actingCount: number;
    ruminatingCount: number;
    plannedCount: number;
    pendingCount: number;
    capacityToday: number | null;
}

export interface CloseMentalThreadInput {
    closureType: ClosureType;
    resolutionSummary: string;
}
