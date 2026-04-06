export type StatType = 'NUMBER' | 'BOOLEAN' | 'RANGE';

export interface StatDefinition {
    id: string;
    name: string;
    description?: string;
    type: StatType;
    minValue?: number;
    maxValue?: number;
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
}

export interface RecordEntryRequest {
    statDefinitionId: string;
    date?: string;
    value: number;
}

export interface StatSummary {
    checkInStreak: number;
    monthlyCheckIns: number | null;   // BOOLEAN only
    booleanStreak: number | null;     // BOOLEAN only
    monthlyAverage: number | null;    // NUMBER / RANGE only
}
