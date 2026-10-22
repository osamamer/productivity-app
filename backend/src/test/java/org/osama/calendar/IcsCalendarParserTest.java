package org.osama.calendar;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

class IcsCalendarParserTest {
    private final IcsCalendarParser parser = new IcsCalendarParser();

    @Test
    void importsOutlookTimeZoneDefinedInTheCalendar() {
        String ics = """
                BEGIN:VCALENDAR
                VERSION:2.0
                PRODID:-//Outlook//EN
                BEGIN:VTIMEZONE
                TZID:W. Europe Standard Time
                BEGIN:STANDARD
                DTSTART:19701025T030000
                TZOFFSETFROM:+0200
                TZOFFSETTO:+0100
                RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU
                END:STANDARD
                BEGIN:DAYLIGHT
                DTSTART:19700329T020000
                TZOFFSETFROM:+0100
                TZOFFSETTO:+0200
                RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU
                END:DAYLIGHT
                END:VTIMEZONE
                BEGIN:VEVENT
                UID:test
                DTSTAMP:20261001T000000Z
                DTSTART;TZID=W. Europe Standard Time:20261017T090000
                DTEND;TZID=W. Europe Standard Time:20261017T100000
                RRULE:FREQ=WEEKLY;COUNT=3
                SUMMARY:Meeting
                END:VEVENT
                END:VCALENDAR
                """;
        var events = parser.parse(ics, LocalDate.of(2026, 10, 17));
        assertThat(events).extracting(event -> event.startTime().toString())
                .containsExactlyInAnyOrder("2026-10-17T07:00:00Z", "2026-10-24T07:00:00Z", "2026-10-31T08:00:00Z");
        assertThat(events).allMatch(event -> "Z".equals(event.timeZone()));
    }

    @Test
    void importsAllDayAndRecurringExceptionsWithoutDuplicates() {
        String ics = """
                BEGIN:VCALENDAR
                VERSION:2.0
                PRODID:-//Claritard Test//EN
                BEGIN:VEVENT
                UID:single
                DTSTAMP:20261001T000000Z
                DTSTART;VALUE=DATE:20261016
                DTEND;VALUE=DATE:20261018
                SUMMARY:Weekend
                END:VEVENT
                BEGIN:VEVENT
                UID:weekly
                DTSTAMP:20261001T000000Z
                DTSTART:20261016T090000Z
                DTEND:20261016T100000Z
                RRULE:FREQ=WEEKLY;COUNT=3
                EXDATE:20261023T090000Z
                SUMMARY:Review
                END:VEVENT
                BEGIN:VEVENT
                UID:weekly
                RECURRENCE-ID:20261030T090000Z
                DTSTAMP:20261001T000000Z
                DTSTART:20261030T110000Z
                DTEND:20261030T120000Z
                SUMMARY:Moved review
                END:VEVENT
                END:VCALENDAR
                """;

        var events = parser.parse(ics, LocalDate.of(2026, 10, 17));

        assertThat(events).hasSize(3);
        assertThat(events).extracting(ImportedCalendarEvent::title)
                .containsExactlyInAnyOrder("Weekend", "Review", "Moved review");
        assertThat(events.stream().filter(ImportedCalendarEvent::allDay).findFirst().orElseThrow().endDate())
                .isEqualTo(LocalDate.of(2026, 10, 17));
    }

    @Test
    void keepsTheSourceTimeZoneForTimedEvents() {
        String ics = """
                BEGIN:VCALENDAR
                VERSION:2.0
                PRODID:-//Claritard Test//EN
                BEGIN:VEVENT
                UID:amman
                DTSTAMP:20261001T000000Z
                DTSTART;TZID=Asia/Amman:20261017T090000
                DTEND;TZID=Asia/Amman:20261017T100000
                SUMMARY:Local meeting
                END:VEVENT
                END:VCALENDAR
                """;

        var event = parser.parse(ics, LocalDate.of(2026, 10, 17)).getFirst();
        assertThat(event.timeZone()).isEqualTo("Asia/Amman");
        assertThat(event.startTime().toString()).isEqualTo("2026-10-17T06:00:00Z");
    }

    @Test
    void importsFloatingTimeAsUtcWhenTheFeedHasNoTimeZone() {
        String ics = """
                BEGIN:VCALENDAR
                VERSION:2.0
                PRODID:-//Claritard Test//EN
                BEGIN:VEVENT
                UID:floating
                DTSTAMP:20261001T000000Z
                DTSTART:20261017T090000
                DTEND:20261017T100000
                SUMMARY:Floating meeting
                END:VEVENT
                END:VCALENDAR
                """;

        var event = parser.parse(ics, LocalDate.of(2026, 10, 17)).getFirst();
        assertThat(event.startTime().toString()).isEqualTo("2026-10-17T09:00:00Z");
    }

    @Test
    void matchesMovedOccurrencesInNamedTimeZones() {
        String ics = """
                BEGIN:VCALENDAR
                VERSION:2.0
                PRODID:-//Claritard Test//EN
                BEGIN:VEVENT
                UID:weekly-local
                DTSTAMP:20261001T000000Z
                DTSTART;TZID=Asia/Amman:20261016T090000
                DTEND;TZID=Asia/Amman:20261016T100000
                RRULE:FREQ=WEEKLY;COUNT=2
                SUMMARY:Local review
                END:VEVENT
                BEGIN:VEVENT
                UID:weekly-local
                RECURRENCE-ID;TZID=Asia/Amman:20261023T090000
                DTSTAMP:20261001T000000Z
                DTSTART;TZID=Asia/Amman:20261023T110000
                DTEND;TZID=Asia/Amman:20261023T120000
                SUMMARY:Moved local review
                END:VEVENT
                END:VCALENDAR
                """;

        var events = parser.parse(ics, LocalDate.of(2026, 10, 17));
        assertThat(events).hasSize(2);
        assertThat(events).extracting(ImportedCalendarEvent::title)
                .containsExactlyInAnyOrder("Local review", "Moved local review");
    }

    @Test
    void recurringLocalTimeStaysFixedAcrossDaylightSavingChange() {
        String ics = """
                BEGIN:VCALENDAR
                VERSION:2.0
                PRODID:-//Claritard Test//EN
                BEGIN:VEVENT
                UID:berlin-weekly
                DTSTAMP:20260301T000000Z
                DTSTART;TZID=Europe/Berlin:20260322T090000
                DTEND;TZID=Europe/Berlin:20260322T100000
                RRULE:FREQ=WEEKLY;COUNT=2
                SUMMARY:Morning meeting
                END:VEVENT
                END:VCALENDAR
                """;

        var events = parser.parse(ics, LocalDate.of(2026, 3, 25));
        assertThat(events).extracting(event -> event.startTime().toString())
                .containsExactlyInAnyOrder("2026-03-22T08:00:00Z", "2026-03-29T07:00:00Z");
    }
}
