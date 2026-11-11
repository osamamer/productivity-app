import { StatEntryStatus, StatType } from '../../types/Stats';

export interface StatChartPoint {
    date: string;
    value: number | undefined;
    primaryValue?: number;
    comparisonValue: number | undefined;
    hoverTarget: number;
    bucketLabel?: string;
    periodEnd?: string;
    status?: StatEntryStatus;
    comparisonStatus?: StatEntryStatus;
    additionalValues?: Partial<Record<StatType, number>>;
}

export interface StatChartPointClickEvent {
    clientX: number;
    clientY: number;
}
