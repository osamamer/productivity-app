package org.osama.calendar;

import org.osama.event.CalendarEventStatus;

import java.time.Instant;
import java.time.LocalDate;

public record ImportedCalendarEvent(String key, String title, String description,
                                    boolean allDay, LocalDate startDate, LocalDate endDate,
                                    Instant startTime, Instant endTime, String timeZone,
                                    CalendarEventStatus status) {
}
