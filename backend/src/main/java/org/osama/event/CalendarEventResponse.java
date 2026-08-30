package org.osama.event;

import java.time.Instant;
import java.time.LocalDate;

public record CalendarEventResponse(
        String id,
        String title,
        String description,
        boolean allDay,
        LocalDate startDate,
        LocalDate endDate,
        Instant startTime,
        Instant endTime,
        String timeZone,
        RecurrenceFrequency recurrenceFrequency,
        LocalDate recurrenceEndDate,
        Integer reminderMinutesBefore,
        Instant createdAt,
        Instant updatedAt
) {
}
