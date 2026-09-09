import { StatEntryStatus } from '../../types/Stats';

export interface StatChartPoint {
    date: string;
    value: number | undefined;
    comparisonValue: number | undefined;
    hoverTarget: number;
    periodEnd?: string;
    status?: StatEntryStatus;
    comparisonStatus?: StatEntryStatus;
}

export interface StatChartPointClickEvent {
    clientX: number;
    clientY: number;
}
