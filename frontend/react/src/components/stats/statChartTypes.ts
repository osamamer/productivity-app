export interface StatChartPoint {
    date: string;
    value: number | undefined;
    comparisonValue: number | undefined;
    hoverTarget: number;
    periodEnd?: string;
}

export interface StatChartPointClickEvent {
    clientX: number;
    clientY: number;
}
