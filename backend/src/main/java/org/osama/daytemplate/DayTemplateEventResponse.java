package org.osama.daytemplate;

import org.osama.event.CalendarEventStatus;

import java.time.LocalTime;

public record DayTemplateEventResponse(
        String id,
        int displayOrder,
        String title,
        String description,
        boolean allDay,
        LocalTime startTime,
        LocalTime endTime,
        String timeZone,
        Integer reminderMinutesBefore,
        CalendarEventStatus status
) {
}
