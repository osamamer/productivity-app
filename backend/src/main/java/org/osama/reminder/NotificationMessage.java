package org.osama.reminder;

import java.time.Instant;
import java.time.ZoneId;

public record NotificationMessage(
        String notificationId,
        NotificationType type,
        String title,
        String body,
        String targetUrl,
        Instant scheduledAt,
        Instant eventStart,
        Boolean allDay
) {
    static NotificationMessage from(Reminder reminder) {
        if (reminder.getNotificationType() == NotificationType.CALENDAR_EVENT && reminder.getEvent() != null) {
            var event = reminder.getEvent();
            Instant eventStart = reminder.getEventOccurrenceStart() != null
                    ? reminder.getEventOccurrenceStart()
                    : event.isAllDay()
                    ? event.getStartDate().atStartOfDay(ZoneId.of(event.getTimeZone())).toInstant()
                    : event.getStartTime();
            return new NotificationMessage(
                    reminder.getReminderId(),
                    reminder.getNotificationType(),
                    event.getTitle(),
                    null,
                    "/calendar",
                    reminder.getDateTime(),
                    eventStart,
                    event.isAllDay()
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
                null
        );
    }
}
