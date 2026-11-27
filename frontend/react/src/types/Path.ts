import type { StatType } from './Stats';

export type SignalCombine = 'AVERAGE' | 'WEAKEST' | 'ALL_MET';
export type InputDirection = 'MORE_IS_BETTER' | 'LESS_IS_BETTER';
export type InputPeriod = 'DAY' | 'WEEK';
export type InputScoring = 'TIMES' | 'TOTAL' | 'DAYS_MET' | 'AVERAGE';
export type PathSort = 'ATTENTION' | 'STRONGEST' | 'CUSTOM';
export type PathShape = 'CURVED' | 'STRAIGHT';
export type PathEdges = 'FOLLOW_WEEKS' | 'CONSTANT';

export const PATH_ICONS = [
    'writer', 'engineer', 'money', 'body', 'mind', 'people', 'learn', 'art', 'music', 'home', 'nature', 'spirit',
] as const;
export type PathIcon = typeof PATH_ICONS[number];

/** One stat feeding a signal. Stat fields are null once that stat has been deleted. */
export interface SignalInput {
    id: string;
    statDefinitionId: string;
    statName: string | null;
    unit: string | null;
    valueSource: string;
    valueType: StatType | null;
    direction: InputDirection;
    period: InputPeriod;
    scoring: InputScoring;
    target: number;
    weight: number;
}

export interface Signal {
    combineMethod: SignalCombine;
    inputs: SignalInput[];
}

export interface Path {
    id: string;
    name: string;
    color: string;
    icon: PathIcon;
    displayOrder: number;
    paused: boolean;
    signal: Signal;
}

export interface WeekInputResult {
    score: number;
    achieved: number;
}

/** A week's strength: 1 is fully kept, up to 1.25 for exceptional weeks. */
export interface WeekStrength {
    weekStart: string;
    elapsedDays: number;
    strength: number;
    inputs: WeekInputResult[];
}

export interface PathView {
    sort: PathSort;
    shape: PathShape;
    edges: PathEdges;
}

export interface PathRoad {
    path: Path;
    /** Oldest first; the last is the current week. */
    weeks: WeekStrength[];
}

export interface PathsOverview {
    today: string;
    view: PathView;
    paths: PathRoad[];
}

export interface SignalInputDraft {
    statDefinitionId: string;
    valueSource: string;
    direction: InputDirection;
    scoring: InputScoring;
    target: number;
    weight: number;
}

export interface SignalDraft {
    combineMethod: SignalCombine;
    inputs: SignalInputDraft[];
}

export interface PathDraft {
    name?: string;
    color?: string;
    icon?: PathIcon;
    paused?: boolean;
    displayOrder?: number;
    signal?: SignalDraft;
}

export interface SignalPreview {
    signal: Signal;
    weeks: WeekStrength[];
}
