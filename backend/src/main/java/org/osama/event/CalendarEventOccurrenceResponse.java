package org.osama.event;

import java.time.Instant;
import java.time.LocalDate;

public record CalendarEventOccurrenceResponse(
        String occurrenceKey,
        CalendarEventStatus status,
        boolean deleted,
        LocalDate startDate,
        LocalDate endDate,
        Instant startTime,
        Instant endTime
) {
}
