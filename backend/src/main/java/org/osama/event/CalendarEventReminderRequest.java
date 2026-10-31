package org.osama.event;

public record CalendarEventReminderRequest(Integer minutesBefore, CalendarEventReminderScope scope) {
}
