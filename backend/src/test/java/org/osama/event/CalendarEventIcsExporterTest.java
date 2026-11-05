package org.osama.event;

import org.junit.jupiter.api.Test;
import org.osama.calendar.IcsCalendarParser;
import org.osama.calendar.ImportedCalendarEvent;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CalendarEventIcsExporterTest {

    private final CalendarEventIcsExporter exporter = new CalendarEventIcsExporter();
    private final IcsCalendarParser parser = new IcsCalendarParser();

    @Test
    void exportsAllDayRecurrenceAndItsCancellationMoveAndDeletionOverrides() {
        LocalDate start = LocalDate.of(2026, 11, 2);
        CalendarEventResponse event = event(true, start, start, null, null, "UTC",
                RecurrenceFrequency.WEEKLY, LocalDate.of(2026, 11, 30), null, null,
                List.of("date:2026-11-09"), List.of(
                        new CalendarEventOccurrenceResponse("date:2026-11-09", CalendarEventStatus.CANCELLED,
                                false, null, null, null, null),
                        new CalendarEventOccurrenceResponse("date:2026-11-16", CalendarEventStatus.CONFIRMED,
                                false, LocalDate.of(2026, 11, 18), LocalDate.of(2026, 11, 18), null, null),
                        new CalendarEventOccurrenceResponse("date:2026-11-23", CalendarEventStatus.CONFIRMED,
                                true, null, null, null, null)));

        String ics = exporter.export(List.of(event));
        List<ImportedCalendarEvent> imported = parser.parse(ics, LocalDate.of(2026, 11, 1));

        assertTrue(ics.startsWith("BEGIN:VCALENDAR\r\n"));
        assertTrue(ics.contains("RRULE:FREQ=WEEKLY;UNTIL=20261130;INTERVAL=1"), ics);
        assertEquals(4, imported.size());
        assertEquals(CalendarEventStatus.CANCELLED, eventOn(imported, LocalDate.of(2026, 11, 9)).status());
        assertEquals(CalendarEventStatus.CONFIRMED, eventOn(imported, LocalDate.of(2026, 11, 18)).status());
        assertFalse(imported.stream().anyMatch(item -> LocalDate.of(2026, 11, 23).equals(item.startDate())));
    }

    @Test
    void includesTimezoneRulesSoRecurringEventsKeepTheirLocalTimeAcrossDst() {
        Instant firstStart = Instant.parse("2026-10-25T13:30:00Z");
        CalendarEventResponse event = event(false, null, null, firstStart, firstStart.plusSeconds(3600),
                "America/New_York", RecurrenceFrequency.WEEKLY, LocalDate.of(2026, 11, 8), null, null,
                List.of(), List.of());

        String ics = exporter.export(List.of(event));
        List<ImportedCalendarEvent> imported = parser.parse(ics, LocalDate.of(2026, 10, 24));

        assertTrue(ics.contains("BEGIN:VTIMEZONE"));
        assertTrue(ics.contains("TZID:America/New_York"));
        assertTrue(ics.contains("VERSION:2.0"));
        assertEquals(List.of(
                Instant.parse("2026-10-25T13:30:00Z"),
                Instant.parse("2026-11-01T14:30:00Z"),
                Instant.parse("2026-11-08T14:30:00Z")),
                imported.stream().map(ImportedCalendarEvent::startTime).toList());
    }

    private CalendarEventResponse event(boolean allDay, LocalDate startDate, LocalDate endDate,
                                        Instant startTime, Instant endTime, String timeZone,
                                        RecurrenceFrequency frequency, LocalDate recurrenceEndDate,
                                        Integer interval, RecurrenceUnit unit,
                                        List<String> cancelledKeys,
                                        List<CalendarEventOccurrenceResponse> overrides) {
        return new CalendarEventResponse("event-1", "Planning session", "Plan the week.", allDay,
                startDate, endDate, startTime, endTime, timeZone, CalendarEventStatus.CONFIRMED,
                frequency, recurrenceEndDate, interval, unit, cancelledKeys, overrides, null,
                Instant.parse("2026-10-01T00:00:00Z"), Instant.parse("2026-10-01T00:00:00Z"),
                "calendar-1", null);
    }

    private ImportedCalendarEvent eventOn(List<ImportedCalendarEvent> events, LocalDate date) {
        return events.stream()
                .filter(event -> date.equals(event.startDate()))
                .findFirst()
                .orElseThrow();
    }
}
