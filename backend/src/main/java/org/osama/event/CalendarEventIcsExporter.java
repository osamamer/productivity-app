package org.osama.event;

import net.fortuna.ical4j.model.Calendar;
import net.fortuna.ical4j.model.DateList;
import net.fortuna.ical4j.model.Property;
import net.fortuna.ical4j.model.ParameterList;
import net.fortuna.ical4j.model.TimeZoneRegistry;
import net.fortuna.ical4j.model.TimeZoneRegistryFactory;
import net.fortuna.ical4j.model.component.CalendarComponent;
import net.fortuna.ical4j.model.component.VEvent;
import net.fortuna.ical4j.model.parameter.TzId;
import net.fortuna.ical4j.model.property.CalScale;
import net.fortuna.ical4j.model.property.Description;
import net.fortuna.ical4j.model.property.DtEnd;
import net.fortuna.ical4j.model.property.DtStart;
import net.fortuna.ical4j.model.property.ExDate;
import net.fortuna.ical4j.model.property.Method;
import net.fortuna.ical4j.model.property.ProdId;
import net.fortuna.ical4j.model.property.RRule;
import net.fortuna.ical4j.model.property.RecurrenceId;
import net.fortuna.ical4j.model.property.Status;
import net.fortuna.ical4j.model.property.Summary;
import net.fortuna.ical4j.model.property.Uid;
import net.fortuna.ical4j.model.property.Version;
import org.springframework.stereotype.Component;

import java.time.DateTimeException;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Component
public class CalendarEventIcsExporter {
    private static final String UID_DOMAIN = "claritard.app";
    private static final DateTimeFormatter UNTIL_FORMAT = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'");

    public String export(List<CalendarEventResponse> events) {
        Calendar calendar = new Calendar();
        addProperty(calendar, new ProdId("-//Claritard//Calendar Export//EN"));
        Version version = new Version();
        version.setValue(Version.VALUE_2_0);
        addProperty(calendar, version);
        addProperty(calendar, new CalScale(CalScale.VALUE_GREGORIAN));
        addProperty(calendar, new Method(Method.VALUE_PUBLISH));

        TimeZoneRegistry timeZoneRegistry = TimeZoneRegistryFactory.getInstance().createRegistry();
        Set<String> includedTimeZones = new HashSet<>();
        for (CalendarEventResponse event : events) {
            ZoneId zone = event.allDay() ? ZoneOffset.UTC : eventZone(event);
            String tzid = isUtc(zone) ? null : includeTimeZone(calendar, timeZoneRegistry, zone, includedTimeZones);
            VEvent master = createEvent(event, zone, tzid);
            addRecurrence(master, event, zone);
            addComponent(calendar, master);
            addOccurrenceOverrides(calendar, master, event, zone, tzid);
        }
        return calendar.toString();
    }

    private VEvent createEvent(CalendarEventResponse event, ZoneId zone, String tzid) {
        VEvent component = new VEvent();
        addIdentityAndDescription(component, event.id(), event.title(), event.description(), event.status());
        if (event.allDay()) {
            if (event.startDate() == null || event.endDate() == null || event.endDate().isBefore(event.startDate())) {
                throw new IllegalStateException("Calendar event has an invalid all-day date range: " + event.id());
            }
            addAllDayRange(component, event.startDate(), event.endDate().plusDays(1));
        } else {
            if (event.startTime() == null || event.endTime() == null || !event.endTime().isAfter(event.startTime())) {
                throw new IllegalStateException("Calendar event has an invalid timed range: " + event.id());
            }
            addTimedRange(component, event.startTime(), event.endTime(), zone, tzid);
        }
        return component;
    }

    private void addIdentityAndDescription(VEvent component, String id, String title, String description,
                                          CalendarEventStatus status) {
        addProperty(component, new Uid(id + "@" + UID_DOMAIN));
        addProperty(component, new Summary(title));
        if (description != null && !description.isBlank()) {
            addProperty(component, new Description(description));
        }
        addProperty(component, new Status(status.name()));
    }

    private void addRecurrence(VEvent component, CalendarEventResponse event, ZoneId zone) {
        if (event.recurrenceFrequency() == null || event.recurrenceFrequency() == RecurrenceFrequency.NONE) return;

        String frequency = switch (event.recurrenceFrequency()) {
            case DAILY -> "DAILY";
            case WEEKLY -> "WEEKLY";
            case MONTHLY -> "MONTHLY";
            case CUSTOM -> switch (event.recurrenceUnit() == null ? RecurrenceUnit.WEEKS : event.recurrenceUnit()) {
                case DAYS -> "DAILY";
                case WEEKS -> "WEEKLY";
                case MONTHS -> "MONTHLY";
            };
            case NONE -> throw new IllegalStateException("A non-recurring event has no recurrence rule.");
        };
        int interval = event.recurrenceFrequency() == RecurrenceFrequency.CUSTOM
                ? Math.max(1, event.recurrenceInterval() == null ? 1 : event.recurrenceInterval())
                : 1;
        StringBuilder rule = new StringBuilder("FREQ=").append(frequency).append(";INTERVAL=").append(interval);
        if (event.recurrenceEndDate() != null) {
            String until = event.allDay()
                    ? event.recurrenceEndDate().format(DateTimeFormatter.BASIC_ISO_DATE)
                    : event.recurrenceEndDate().atTime(LocalTime.of(23, 59, 59)).atZone(zone)
                            .withZoneSameInstant(ZoneOffset.UTC).format(UNTIL_FORMAT);
            rule.append(";UNTIL=").append(until);
        }
        addProperty(component, new RRule<>(rule.toString()));
    }

    private void addOccurrenceOverrides(Calendar calendar, VEvent master, CalendarEventResponse event,
                                        ZoneId zone, String tzid) {
        if (event.recurrenceFrequency() == null || event.recurrenceFrequency() == RecurrenceFrequency.NONE) return;

        Set<String> handledKeys = new HashSet<>();
        List<CalendarEventOccurrenceResponse> overrides = event.occurrenceOverrides() == null
                ? List.of()
                : event.occurrenceOverrides();
        for (CalendarEventOccurrenceResponse override : overrides) {
            if (override.occurrenceKey() == null) continue;
            handledKeys.add(override.occurrenceKey());
            if (override.deleted()) {
                addExclusion(master, event, override.occurrenceKey(), zone, tzid);
                continue;
            }

            boolean moved = event.allDay()
                    ? override.startDate() != null && override.endDate() != null
                    : override.startTime() != null && override.endTime() != null;
            CalendarEventStatus status = override.status() == null ? event.status() : override.status();
            if (!moved && status == event.status()) continue;
            addComponent(calendar, createOccurrenceOverride(event, override, status, zone, tzid));
        }

        for (String occurrenceKey : event.cancelledOccurrenceKeys() == null
                ? List.<String>of()
                : event.cancelledOccurrenceKeys()) {
            if (!handledKeys.contains(occurrenceKey)) {
                CalendarEventOccurrenceResponse cancellation = new CalendarEventOccurrenceResponse(
                        occurrenceKey, CalendarEventStatus.CANCELLED, false, null, null, null, null);
                addComponent(calendar, createOccurrenceOverride(
                        event, cancellation, CalendarEventStatus.CANCELLED, zone, tzid));
            }
        }
    }

    private VEvent createOccurrenceOverride(CalendarEventResponse event, CalendarEventOccurrenceResponse override,
                                            CalendarEventStatus status, ZoneId zone, String tzid) {
        VEvent component = new VEvent();
        addIdentityAndDescription(component, event.id(), event.title(), event.description(), status);
        if (event.allDay()) {
            LocalDate originalStart = occurrenceDate(override.occurrenceKey());
            LocalDate start = override.startDate() == null ? originalStart : override.startDate();
            LocalDate endExclusive = override.endDate() == null
                    ? originalStart.plusDays(allDayDuration(event))
                    : override.endDate().plusDays(1);
            addProperty(component, new RecurrenceId<>(originalStart));
            addAllDayRange(component, start, endExclusive);
        } else {
            Instant originalStart = occurrenceInstant(override.occurrenceKey());
            Instant start = override.startTime() == null ? originalStart : override.startTime();
            Instant end = override.endTime() == null
                    ? start.plus(timedDuration(event))
                    : override.endTime();
            addRecurrenceId(component, originalStart, zone, tzid);
            addTimedRange(component, start, end, zone, tzid);
        }
        return component;
    }

    private void addExclusion(VEvent master, CalendarEventResponse event, String occurrenceKey,
                              ZoneId zone, String tzid) {
        if (event.allDay()) {
            addProperty(master, new ExDate<>(new DateList<>(List.of(occurrenceDate(occurrenceKey)))));
        } else if (isUtc(zone)) {
            addProperty(master, new ExDate<>(new DateList<>(List.of(occurrenceInstant(occurrenceKey)))));
        } else {
            ParameterList parameters = new ParameterList().add(new TzId(tzid));
            LocalDateTime localStart = LocalDateTime.ofInstant(occurrenceInstant(occurrenceKey), zone);
            addProperty(master, new ExDate<>(parameters, new DateList<>(List.of(localStart))));
        }
    }

    private void addRecurrenceId(VEvent component, Instant originalStart, ZoneId zone, String tzid) {
        if (isUtc(zone)) {
            addProperty(component, new RecurrenceId<>(originalStart));
        } else {
            ParameterList parameters = new ParameterList().add(new TzId(tzid));
            addProperty(component, new RecurrenceId<>(
                    parameters, LocalDateTime.ofInstant(originalStart, zone)));
        }
    }

    private void addAllDayRange(VEvent component, LocalDate start, LocalDate endExclusive) {
        addProperty(component, new DtStart<>(start));
        addProperty(component, new DtEnd<>(endExclusive));
    }

    private void addTimedRange(VEvent component, Instant start, Instant end, ZoneId zone, String tzid) {
        if (isUtc(zone)) {
            addProperty(component, new DtStart<>(start));
            addProperty(component, new DtEnd<>(end));
        } else {
            ParameterList parameters = new ParameterList().add(new TzId(tzid));
            addProperty(component, new DtStart<>(parameters,
                    LocalDateTime.ofInstant(start, zone)));
            addProperty(component, new DtEnd<>(new ParameterList().add(new TzId(tzid)),
                    LocalDateTime.ofInstant(end, zone)));
        }
    }

    private String includeTimeZone(Calendar calendar, TimeZoneRegistry registry, ZoneId zone,
                                  Set<String> includedTimeZones) {
        String tzid = registry.getTzId(zone.getId());
        if (tzid == null || tzid.isBlank()) tzid = zone.getId();
        if (!includedTimeZones.add(tzid)) return tzid;

        net.fortuna.ical4j.model.TimeZone timeZone = registry.getTimeZone(tzid);
        if (timeZone == null) {
            includedTimeZones.remove(tzid);
            throw new IllegalStateException("Calendar time zone could not be exported: " + zone.getId());
        }
        addComponent(calendar, timeZone.getVTimeZone());
        return tzid;
    }

    private void addProperty(Calendar calendar, Property property) {
        calendar.setPropertyList(calendar.getPropertyList().add(property));
    }

    private void addProperty(VEvent event, Property property) {
        event.setPropertyList(event.getPropertyList().add(property));
    }

    private void addComponent(Calendar calendar, CalendarComponent component) {
        calendar.setComponentList(calendar.getComponentList().add(component));
    }

    private ZoneId eventZone(CalendarEventResponse event) {
        try {
            return ZoneId.of(event.timeZone());
        } catch (DateTimeException exception) {
            return ZoneOffset.UTC;
        }
    }

    private boolean isUtc(ZoneId zone) {
        return zone.getRules().isFixedOffset()
                && zone.getRules().getOffset(Instant.EPOCH).equals(ZoneOffset.UTC);
    }

    private LocalDate occurrenceDate(String key) {
        if (key == null || !key.startsWith("date:")) {
            throw new IllegalStateException("Calendar event has an invalid all-day occurrence key.");
        }
        return LocalDate.parse(key.substring("date:".length()));
    }

    private Instant occurrenceInstant(String key) {
        if (key == null || !key.startsWith("instant:")) {
            throw new IllegalStateException("Calendar event has an invalid timed occurrence key.");
        }
        return Instant.parse(key.substring("instant:".length()));
    }

    private long allDayDuration(CalendarEventResponse event) {
        if (event.startDate() == null || event.endDate() == null) return 1;
        return Math.max(1, Duration.between(event.startDate().atStartOfDay(), event.endDate().plusDays(1).atStartOfDay()).toDays());
    }

    private Duration timedDuration(CalendarEventResponse event) {
        if (event.startTime() == null || event.endTime() == null) return Duration.ZERO;
        return Duration.between(event.startTime(), event.endTime());
    }
}
