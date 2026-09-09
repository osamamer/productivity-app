export type StatType = 'NUMBER' | 'BOOLEAN' | 'RANGE' | 'TIME' | 'DURATION';
export type StatMorality = 'GOOD' | 'BAD' | 'NEUTRAL';
export type StatEntryStatus = 'RECORDED' | 'NOT_PLANNED';
export type StatFeedback = 'CELEBRATE' | 'SAD' | 'NONE';
export type StatRecurrenceFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';
export type StatRecurrenceDay =
    'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';

export type StatRecurringTaskDraft = {
    recurrenceFrequency: StatRecurrenceFrequency;
    recurrenceDaysOfWeek: StatRecurrenceDay[];
};

export interface StatDefinition {
    id: string;
    name: string;
    description?: string;
    type: StatType;
    morality?: StatMorality | null;
    minValue?: number;
    maxValue?: number;
    goodThreshold?: number | null;
    systemKey?: string;
    recurringTaskSeriesId?: string | null;
    displayOrder: number;
    userId: string;
}

export interface StatEntry {
    id: string;
    statDefinitionId: string;
    statDefinition: StatDefinition;
    date: string; // 'YYYY-MM-DD'
    value: number;
    status?: StatEntryStatus;
    userId: string;
}

export interface StatFocusTimeEntry {
    date: string;
    totalFocusSeconds: number;
}

export interface CreateDefinitionRequest {
    name: string;
    description?: string;
    type: StatType;
    minValue?: number;
    maxValue?: number;
    morality?: StatMorality;
    goodThreshold?: number;
    createRecurringTask?: boolean;
    recurrenceFrequency?: StatRecurrenceFrequency;
    recurrenceDaysOfWeek?: StatRecurrenceDay[];
}

export interface UpdateDefinitionRequest {
    name: string;
    description?: string;
    morality?: StatMorality;
    goodThreshold?: number;
}

export interface RecordEntryRequest {
    statDefinitionId: string;
    date?: string;
    value: number | null;
    status?: StatEntryStatus;
}

export interface StatSummary {
    checkInStreak: number;
    periodYesCount: number | null;    // BOOLEAN only
    booleanStreak: number | null;     // BOOLEAN only
    longestBooleanStreak?: number | null; // BOOLEAN only
    periodAverage: number | null;     // NUMBER / RANGE / TIME / DURATION
    periodTotal: number | null;       // NUMBER / RANGE / TIME / DURATION
    periodHighest?: number | null;     // NUMBER / RANGE / TIME / DURATION
}

export interface StatBootstrapResponse {
    from: string;
    to: string;
    definitions: StatDefinition[];
    entries: Record<string, StatEntry[]>;
    summaries: Record<string, StatSummary>;
}

export type CorrelationStrength = 'STRONG' | 'MODERATE' | 'MILD' | 'NONE' | 'INSUFFICIENT_DATA' | 'NO_VARIATION';
export type CorrelationDirection = 'POSITIVE' | 'NEGATIVE' | 'NONE';

export interface StatCorrelation {
    statDefinitionId: string;
    statName: string;
    statType: StatType;
    overlapDays: number;
    correlation: number | null;
    strength: CorrelationStrength;
    direction: CorrelationDirection;
    meaningful: boolean;
    otherAverageWhenDriverHigher: number | null;
    otherAverageWhenDriverLower: number | null;
    insight: string;
}

export interface StatInsights {
    statDefinitionId: string;
    statName: string;
    from: string;
    to: string;
    recordedDays: number;
    correlations: StatCorrelation[];
}
