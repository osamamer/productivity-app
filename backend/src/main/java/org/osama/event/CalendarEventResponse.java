package org.osama.event;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

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
        CalendarEventStatus status,
        RecurrenceFrequency recurrenceFrequency,
        LocalDate recurrenceEndDate,
        Integer recurrenceInterval,
        RecurrenceUnit recurrenceUnit,
        List<String> cancelledOccurrenceKeys,
        List<CalendarEventOccurrenceResponse> occurrenceOverrides,
        Integer reminderMinutesBefore,
        Instant createdAt,
        Instant updatedAt
) {
}
