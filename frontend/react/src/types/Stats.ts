export type StatType = 'NUMBER' | 'BOOLEAN' | 'RANGE';
export type StatMorality = 'GOOD' | 'BAD' | 'NEUTRAL';
export type StatFeedback = 'CELEBRATE' | 'SAD' | 'NONE';

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
    displayOrder: number;
    userId: string;
}

export interface StatEntry {
    id: string;
    statDefinitionId: string;
    statDefinition: StatDefinition;
    date: string; // 'YYYY-MM-DD'
    value: number;
    userId: string;
}

export interface CreateDefinitionRequest {
    name: string;
    description?: string;
    type: StatType;
    minValue?: number;
    maxValue?: number;
    morality?: StatMorality;
    goodThreshold?: number;
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
    value: number;
}

export interface StatSummary {
    checkInStreak: number;
    periodYesCount: number | null;    // BOOLEAN only
    booleanStreak: number | null;     // BOOLEAN only
    longestBooleanStreak?: number | null; // BOOLEAN only
    periodAverage: number | null;     // NUMBER / RANGE only
    periodTotal: number | null;       // NUMBER / RANGE only
    periodHighest?: number | null;     // NUMBER / RANGE only
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
