export type NotificationType =
    | 'CALENDAR_EVENT'
    | 'TASK_REMINDER'
    | 'MENTAL_STATE_CHECKUP'
    | 'POMODORO_FOCUS_ENDED'
    | 'POMODORO_BREAK_ENDED'
    | 'POMODORO_COMPLETED';

export type ApplicationNotification = {
    notificationId: string;
    type: NotificationType;
    title: string;
    body: string | null;
    targetUrl: string | null;
    scheduledAt: string;
    eventStart: string | null;
    allDay: boolean | null;
};
