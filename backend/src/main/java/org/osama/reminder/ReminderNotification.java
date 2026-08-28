package org.osama.reminder;

import java.time.Instant;

public record ReminderNotification(
        String reminderId,
        String eventId,
        String title,
        Instant eventStart,
        boolean allDay
) {
    static ReminderNotification from(Reminder reminder) {
        var event = reminder.getEvent();
        Instant eventStart = event.isAllDay()
                ? event.getStartDate().atStartOfDay(java.time.ZoneId.of(event.getTimeZone())).toInstant()
                : event.getStartTime();
        return new ReminderNotification(reminder.getReminderId(), event.getId(), event.getTitle(),
                eventStart, event.isAllDay());
    }
}
