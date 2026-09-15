package org.osama.reminder;

import java.time.Instant;

public record NotificationMessage(
        String notificationId,
        NotificationType type,
        String title,
        String body,
        String targetUrl,
        Instant scheduledAt,
        Instant eventStart,
        Boolean allDay,
        String taskId
) {
    static NotificationMessage from(Reminder reminder) {
        if (reminder.getNotificationType() == NotificationType.CALENDAR_EVENT && reminder.getEvent() != null) {
            var event = reminder.getEvent();
            Instant eventStart = reminder.getDateTime().plusSeconds(reminder.getMinutesBefore() * 60L);
            return new NotificationMessage(
                    reminder.getReminderId(),
                    reminder.getNotificationType(),
                    event.getTitle(),
                    null,
                    "/calendar",
                    reminder.getDateTime(),
                    eventStart,
                    event.isAllDay(),
                    null
            );
        }

        return new NotificationMessage(
                reminder.getReminderId(),
                reminder.getNotificationType(),
                reminder.getTitle(),
                reminder.getBody(),
                reminder.getTargetUrl(),
                reminder.getDateTime(),
                null,
                null,
                reminder.getTaskId()
        );
    }
}
