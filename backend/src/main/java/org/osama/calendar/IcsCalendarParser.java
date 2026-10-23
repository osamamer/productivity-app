package org.osama.calendar;

import lombok.extern.slf4j.Slf4j;
import net.fortuna.ical4j.data.CalendarBuilder;
import net.fortuna.ical4j.model.Period;
import net.fortuna.ical4j.model.Property;
import net.fortuna.ical4j.model.component.VEvent;
import net.fortuna.ical4j.model.property.DateProperty;
import org.osama.event.CalendarEventStatus;
import org.springframework.stereotype.Component;

import java.io.StringReader;
import java.time.*;
import java.time.temporal.Temporal;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
@Slf4j
public class IcsCalendarParser {
    private static final int MAX_OCCURRENCES = 5000;
    private static final Set<String> JAVA_TIME_ZONES = ZoneId.getAvailableZoneIds();
    private static final Pattern CANCELLED_TITLE_PREFIX = Pattern.compile(
            "^\\s*cancel(?:l)?ed\\s*:\\s*", Pattern.CASE_INSENSITIVE);

    public List<ImportedCalendarEvent> parse(String ics, LocalDate today) {
        try {
            var calendar = new CalendarBuilder().build(new StringReader(ics));
            List<VEvent> events = calendar.getComponents(VEvent.VEVENT);
            Map<String, VEvent> exceptions = new HashMap<>();
            Map<String, VEvent> masters = new HashMap<>();
            for (VEvent event : events) {
                String recurrenceId = recurrenceId(event);
                if (recurrenceId != null) exceptions.put(key(uid(event), recurrenceId), event);
                else masters.put(uid(event), event);
            }

            LocalDate windowStart = today.minusYears(1);
            LocalDate windowEnd = today.plusYears(2);
            Map<String, ImportedCalendarEvent> imported = new LinkedHashMap<>();
            for (VEvent event : events) {
                if (recurrenceId(event) != null) continue;
                for (Property rule : event.getProperties(Property.RRULE)) {
                    String value = rule.getValue().toUpperCase(Locale.ROOT);
                    if (value.contains("FREQ=SECONDLY") || value.contains("FREQ=MINUTELY")
                            || value.contains("FREQ=HOURLY")) {
                        throw new IllegalArgumentException("Calendar repeats too frequently for import.");
                    }
                }
                DateProperty<?> startProperty = event.getDateTimeStart();
                if (startProperty == null) continue;
                ZoneId zone = zone(startProperty);
                Temporal start = startProperty.getDate();
                boolean allDay = start instanceof LocalDate;
                if (allDay) {
                    var range = new Period<>(windowStart, windowEnd);
                    for (Period<LocalDate> period : event.<LocalDate>calculateRecurrenceSet(range)) {
                        add(imported, exceptions, event, period.getStart(), period.getEnd(), zone);
                    }
                } else {
                    var range = new Period<>(windowStart.atStartOfDay(zone), windowEnd.atStartOfDay(zone));
                    for (Period<ZonedDateTime> period : event.<ZonedDateTime>calculateRecurrenceSet(range)) {
                        add(imported, exceptions, event, period.getStart(), period.getEnd(), zone);
                    }
                }
                if (imported.size() > MAX_OCCURRENCES) throw new IllegalArgumentException("Calendar has too many events in the sync window.");
            }
            // A moved exception can fall inside the window even when its original start does not.
            for (VEvent exception : exceptions.values()) {
                String exceptionKey = key(uid(exception), Objects.requireNonNull(recurrenceId(exception)));
                if (exception.getDateTimeStart() == null && imported.containsKey(exceptionKey)) continue;
                imported.remove(exceptionKey);
                DateProperty<?> startProperty = exception.getDateTimeStart();
                DateProperty<?> recurrenceProperty = recurrenceIdProperty(exception);
                Temporal fallbackStart = startProperty == null && recurrenceProperty != null
                        ? recurrenceProperty.getDate() : null;
                ZoneId exceptionZone = zone(startProperty == null ? recurrenceProperty : startProperty);
                ImportedCalendarEvent occurrence = describe(exception, exceptionKey, fallbackStart, null,
                        exceptionZone, masters.get(uid(exception)));
                if (inWindow(occurrence, windowStart, windowEnd)) {
                    imported.put(exceptionKey, occurrence);
                }
            }
            if (imported.size() > MAX_OCCURRENCES) throw new IllegalArgumentException("Calendar has too many events in the sync window.");
            return List.copyOf(imported.values());
        } catch (Exception exception) {
            // Parser exceptions can include private event text; keep them out of API responses and sync logs.
            var diagnostic = new IllegalArgumentException("Calendar parse failure: " + exception.getClass().getSimpleName());
            diagnostic.setStackTrace(exception.getStackTrace());
            log.warn("Calendar source could not be parsed", diagnostic);
            throw new IllegalArgumentException("The calendar file could not be read.");
        }
    }

    private void add(Map<String, ImportedCalendarEvent> imported, Map<String, VEvent> exceptions,
                     VEvent master, Temporal start, Temporal end, ZoneId zone) {
        String occurrenceKey = key(uid(master), start.toString());
        VEvent exception = exceptions.get(occurrenceKey);
        if (exception != null) {
            ImportedCalendarEvent override = describe(exception, occurrenceKey, start, end, zone, master);
            imported.put(occurrenceKey, override);
        } else {
            ImportedCalendarEvent occurrence = describe(master, occurrenceKey, start, end, zone, null);
            imported.put(occurrenceKey, occurrence);
        }
    }

    private ImportedCalendarEvent describe(VEvent event, String key, Temporal occurrenceStart,
                                            Temporal occurrenceEnd, ZoneId zone, VEvent fallbackEvent) {
        DateProperty<?> startProperty = event.getDateTimeStart();
        boolean useOccurrenceRange = fallbackEvent == null && occurrenceStart != null;
        Temporal start = useOccurrenceRange || startProperty == null ? occurrenceStart : startProperty.getDate();
        if (start == null) throw new IllegalArgumentException("A calendar event has no start time.");
        Temporal end = useOccurrenceRange && occurrenceEnd != null
                ? occurrenceEnd
                : startProperty == null && occurrenceEnd == null && fallbackEvent != null
                    ? endOf(fallbackEvent, start, null, false)
                    : endOf(event, start, occurrenceEnd, startProperty == null);
        String title = Optional.ofNullable(value(event, Property.SUMMARY)).filter(s -> !s.isBlank())
                .or(() -> fallbackEvent == null ? Optional.empty()
                        : Optional.ofNullable(value(fallbackEvent, Property.SUMMARY)).filter(s -> !s.isBlank()))
                .orElse("Untitled event");
        Matcher cancelledTitle = CANCELLED_TITLE_PREFIX.matcher(title);
        boolean titleMarksCancelled = cancelledTitle.find();
        if (titleMarksCancelled) title = title.substring(cancelledTitle.end()).strip();
        if (title.isBlank()) title = "Untitled event";
        if (title.length() > 200) title = title.substring(0, 200);
        String description = Optional.ofNullable(value(event, Property.DESCRIPTION))
                .orElseGet(() -> fallbackEvent == null
                        ? "" : Optional.ofNullable(value(fallbackEvent, Property.DESCRIPTION)).orElse(""));
        CalendarEventStatus status = switch (Optional.ofNullable(value(event, Property.STATUS))
                .orElse("CONFIRMED").toUpperCase(Locale.ROOT)) {
            case "CANCELLED" -> CalendarEventStatus.CANCELLED;
            case "TENTATIVE" -> CalendarEventStatus.TENTATIVE;
            default -> CalendarEventStatus.CONFIRMED;
        };
        if (titleMarksCancelled) status = CalendarEventStatus.CANCELLED;
        if (start instanceof LocalDate startDate) {
            LocalDate endDate = end instanceof LocalDate d ? d : startDate.plusDays(1);
            return new ImportedCalendarEvent(key, title, description, true, startDate, endDate.minusDays(1),
                    null, null, zone.getId(), status);
        }
        return new ImportedCalendarEvent(key, title, description, false, null, null,
                instant(start, zone), instant(end, zone), zone.getId(), status);
    }

    private Temporal endOf(VEvent event, Temporal start, Temporal fallbackEnd, boolean useFallbackEnd) {
        DateProperty<?> end = event.getDateTimeEnd();
        if (end != null) return end.getDate();
        var duration = event.getDuration();
        if (duration != null) return (Temporal) duration.getDuration().addTo(start);
        if (useFallbackEnd && fallbackEnd != null) return fallbackEnd;
        return start instanceof LocalDate date ? date.plusDays(1) : (Temporal) Duration.ofHours(1).addTo(start);
    }

    private boolean inWindow(ImportedCalendarEvent event, LocalDate from, LocalDate to) {
        LocalDate date = event.allDay() ? event.startDate() : event.startTime().atZone(ZoneId.of(event.timeZone())).toLocalDate();
        return !date.isBefore(from) && date.isBefore(to);
    }

    private ZoneId zone(DateProperty<?> property) {
        if (property == null) return ZoneOffset.UTC;
        String tzid = property.getParameter("TZID").map(parameter -> parameter.getValue()).orElse(null);
        if (tzid != null) {
            // iCalendar permits source-defined TZIDs. iCal4j uses their VTIMEZONE for the
            // parsed instant; UTC is a portable display zone for IDs Java cannot resolve.
            return JAVA_TIME_ZONES.contains(tzid) ? ZoneId.of(tzid) : ZoneOffset.UTC;
        }
        // Floating iCalendar times have no owner zone in the current account model.
        return ZoneOffset.UTC;
    }

    private Instant instant(Temporal temporal, ZoneId zone) {
        if (temporal instanceof Instant instant) return instant;
        if (temporal instanceof ZonedDateTime dateTime) return dateTime.toInstant();
        if (temporal instanceof OffsetDateTime dateTime) return dateTime.toInstant();
        return LocalDateTime.from(temporal).atZone(zone).toInstant();
    }

    private String uid(VEvent event) {
        return event.getUid().map(Property::getValue)
                .orElseThrow(() -> new IllegalArgumentException("A calendar event has no UID."));
    }

    private String key(String uid, String occurrence) {
        return UUID.nameUUIDFromBytes((uid + "\u0000" + occurrence).getBytes(java.nio.charset.StandardCharsets.UTF_8)).toString();
    }

    private String value(VEvent event, String property) {
        return event.getProperty(property).map(Property::getValue).orElse(null);
    }

    private String recurrenceId(VEvent event) {
        DateProperty<?> recurrenceId = recurrenceIdProperty(event);
        return recurrenceId == null ? null : recurrenceId.getDate().toString();
    }

    private DateProperty<?> recurrenceIdProperty(VEvent event) {
        return event.<DateProperty<?>>getProperty(Property.RECURRENCE_ID).orElse(null);
    }
}
