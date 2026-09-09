package org.osama.daytemplate;

import org.osama.event.CalendarEventStatus;

import java.time.LocalTime;

public record DayTemplateEventRequest(
        String title,
        String description,
        boolean allDay,
        LocalTime startTime,
        LocalTime endTime,
        String timeZone,
        Integer reminderMinutesBefore,
        CalendarEventStatus status
) {
    public DayTemplateEventRequest(String title, String description, boolean allDay,
                                   LocalTime startTime, LocalTime endTime, String timeZone,
                                   Integer reminderMinutesBefore) {
        this(title, description, allDay, startTime, endTime, timeZone, reminderMinutesBefore,
                CalendarEventStatus.CONFIRMED);
    }
}
