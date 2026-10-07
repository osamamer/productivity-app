export interface CalendarChoice {
  id: string;
  isDefault: boolean;
  visible: boolean;
}

export function initialCalendarId(calendars: CalendarChoice[]): string {
  const visible = calendars.filter(calendar => calendar.visible);
  if (visible.length === 1) return visible[0].id;
  return calendars.find(calendar => calendar.isDefault)?.id ?? '';
}

export function createCalendarOptions<T extends CalendarChoice>(calendars: T[]): T[] {
  const visible = calendars.filter(calendar => calendar.visible);
  return visible.length < 2 ? [] : visible;
}

export function filterByVisibleCalendar<T extends { calendarId: string }>(items: T[], calendars: CalendarChoice[]): T[] {
  const visibleIds = new Set(calendars.filter(calendar => calendar.visible).map(calendar => calendar.id));
  return items.filter(item => visibleIds.has(item.calendarId));
}
