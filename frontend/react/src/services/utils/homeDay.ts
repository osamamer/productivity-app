function normalizeHomeDayEndHour(hour: number): number {
    return Number.isInteger(hour) ? Math.min(5, Math.max(0, hour)) : 0;
}

export function getHomeDisplayDate(now: Date, dayEndHour: number): Date {
    const displayDate = new Date(now);
    displayDate.setHours(0, 0, 0, 0);
    if (now.getHours() < normalizeHomeDayEndHour(dayEndHour)) {
        displayDate.setDate(displayDate.getDate() - 1);
    }
    return displayDate;
}

export function getNextHomeDayBoundary(now: Date, dayEndHour: number): Date {
    const boundary = new Date(now);
    boundary.setHours(normalizeHomeDayEndHour(dayEndHour), 0, 0, 0);
    if (boundary <= now) boundary.setDate(boundary.getDate() + 1);
    return boundary;
}
