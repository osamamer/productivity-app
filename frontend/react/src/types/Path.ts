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

export type CheckpointAggregation = 'SUM' | 'COUNT_DAYS' | 'LATEST';

export interface CheckpointMetric {
    statDefinitionId: string;
    statName: string | null;
    unit: string | null;
    valueSource: string;
    valueType: StatType | null;
    aggregation: CheckpointAggregation;
    countFrom: string;
    baseline: number;
    targetValue: number;
    /** LATEST on a less-is-better stat: reached when the value falls to the target. */
    falling: boolean;
}

/** A dated step inside a project; done once its metric reaches the target (`reachedOn`). */
export interface Checkpoint {
    id: string;
    projectId: string;
    name: string;
    targetDate: string | null;
    displayOrder: number;
    metric: CheckpointMetric;
    current: number | null;
    progress: number;
    reachedOn: string | null;
    taskCount: number;
    completedTaskCount: number;
}

/** The end of one project on a path. Undated milestones sit in the Someday zone. */
export interface Milestone {
    id: string;
    projectId: string;
    name: string;
    targetDate: string | null;
    displayOrder: number;
    done: boolean;
    doneOn: string | null;
    progress: number;
    taskCount: number;
    completedTaskCount: number;
    checkpoints: Checkpoint[];
}

export interface MilestoneDraft {
    name?: string;
    targetDate?: string | null;
    displayOrder?: number;
    done?: boolean;
}

export interface CheckpointDraft {
    name?: string;
    targetDate?: string | null;
    statDefinitionId?: string;
    valueSource?: string;
    aggregation?: CheckpointAggregation;
    countFrom?: string;
    baseline?: number;
    targetValue?: number;
}

export interface PathRoad {
    path: Path;
    /** Oldest first; the last is the current week. */
    weeks: WeekStrength[];
    /** In display order, with their checkpoints. */
    milestones: Milestone[];
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
