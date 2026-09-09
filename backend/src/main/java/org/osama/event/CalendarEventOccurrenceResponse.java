package org.osama.event;

public record CalendarEventOccurrenceResponse(
        String occurrenceKey,
        CalendarEventStatus status,
        boolean deleted
) {
}
