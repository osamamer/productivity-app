export function isNormalCalendarEvent(event: { activityId?: string | null; taskId?: string | null }): boolean {
  return !event.activityId && !event.taskId;
}
