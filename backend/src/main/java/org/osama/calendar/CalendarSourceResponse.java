package org.osama.calendar;

import java.time.Instant;

public record CalendarSourceResponse(String id, String calendarId, CalendarSource.Type type,
                                     Instant lastSyncedAt, String lastError) {
    public static CalendarSourceResponse from(CalendarSource source) {
        return new CalendarSourceResponse(source.getId(), source.getCalendarId(), source.getType(),
                source.getLastSyncedAt(), source.getLastError());
    }
}
