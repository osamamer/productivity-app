package org.osama.calendar;

import lombok.extern.slf4j.Slf4j;
import org.osama.event.CalendarEvent;
import org.osama.event.CalendarEventReminderService;
import org.osama.event.CalendarEventRepository;
import org.osama.exceptions.ResourceNotFoundException;
import org.osama.user.UserRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.*;

@Service
@Slf4j
public class CalendarSourceService {
    private final CalendarSourceRepository sources;
    private final CalendarEventRepository events;
    private final CalendarEventReminderService eventReminders;
    private final CalendarService calendars;
    private final UserRepository users;
    private final IcsCalendarParser parser;
    private final IcsFeedClient feeds;
    private final TransactionTemplate transaction;

    public CalendarSourceService(CalendarSourceRepository sources, CalendarEventRepository events,
                                 CalendarEventReminderService eventReminders,
                                 CalendarService calendars, UserRepository users,
                                 IcsCalendarParser parser, IcsFeedClient feeds, TransactionTemplate transaction) {
        this.sources = sources;
        this.events = events;
        this.eventReminders = eventReminders;
        this.calendars = calendars;
        this.users = users;
        this.parser = parser;
        this.feeds = feeds;
        this.transaction = transaction;
    }

    public List<CalendarSourceResponse> list(String userId) {
        return sources.findAllByUserId(userId).stream().map(CalendarSourceResponse::from).toList();
    }

    public CalendarSourceResponse addUrl(String userId, String name, String color, String url) {
        String payload = feeds.fetch(url);
        return create(userId, name, color, CalendarSource.Type.ICS_URL, url, payload);
    }

    public CalendarSourceResponse addFile(String userId, String name, String color, byte[] bytes) {
        if (bytes.length > IcsFeedClient.MAX_BYTES) throw new IllegalArgumentException("Calendar file is too large.");
        String payload = new String(bytes, StandardCharsets.UTF_8);
        return create(userId, name, color, CalendarSource.Type.ICS_FILE, null, payload);
    }

    private CalendarSourceResponse create(String userId, String name, String color,
                                          CalendarSource.Type type, String url, String payload) {
        List<ImportedCalendarEvent> imported = parser.parse(payload, LocalDate.now(ZoneOffset.UTC));
        return transaction.execute(status -> {
            if (sources.findAllByUserId(userId).size() >= 20) {
                throw new IllegalArgumentException("A maximum of 20 external calendars is supported.");
            }
            CalendarResponse calendar = calendars.createCalendar(new CreateCalendarRequest(name, color), userId);
            CalendarSource source = new CalendarSource();
            source.setId(UUID.randomUUID().toString());
            source.setUserId(userId);
            source.setCalendarId(calendar.id());
            source.setType(type);
            source.setSourceUrl(url);
            source.setSourcePayload(payload);
            source.setLastSyncedAt(Instant.now());
            sources.save(source);
            apply(source, imported);
            log.info("Calendar source created: userId={} sourceId={} type={} eventCount={}",
                    userId, source.getId(), type, imported.size());
            return CalendarSourceResponse.from(source);
        });
    }

    public CalendarSourceResponse sync(String userId, String sourceId) {
        CalendarSource source = sources.findByIdAndUserId(sourceId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Calendar source not found: " + sourceId));
        try {
            String payload = source.getType() == CalendarSource.Type.ICS_URL
                    ? feeds.fetch(source.getSourceUrl()) : source.getSourcePayload();
            List<ImportedCalendarEvent> imported = parser.parse(payload, LocalDate.now(ZoneOffset.UTC));
            return transaction.execute(status -> {
                CalendarSource current = sources.lockByIdAndUserId(sourceId, userId)
                        .orElseThrow(() -> new ResourceNotFoundException("Calendar source not found: " + sourceId));
                apply(current, imported);
                current.setSourcePayload(payload);
                current.setLastSyncedAt(Instant.now());
                current.setLastError(null);
                sources.save(current);
                log.info("Calendar source synced: userId={} sourceId={} eventCount={}", userId, sourceId, imported.size());
                return CalendarSourceResponse.from(current);
            });
        } catch (RuntimeException exception) {
            log.error("Calendar source sync failed: userId={} sourceId={}: {}",
                    userId, sourceId, exception.getMessage(), exception);
            transaction.executeWithoutResult(status -> sources.findByIdAndUserId(sourceId, userId).ifPresent(current -> {
                current.setLastError("Could not refresh this calendar. Try again later.");
                sources.save(current);
            }));
            throw exception;
        }
    }

    private void apply(CalendarSource source, List<ImportedCalendarEvent> imported) {
        Map<String, CalendarEvent> existing = new HashMap<>();
        for (CalendarEvent event : events.findAllBySourceId(source.getId())) existing.put(event.getExternalKey(), event);
        var user = users.findUserById(source.getUserId()).orElseThrow();
        for (ImportedCalendarEvent item : imported) {
            CalendarEvent event = existing.remove(item.key());
            if (event == null) {
                event = new CalendarEvent();
                event.setId(UUID.randomUUID().toString());
                event.setUser(user);
                event.setCalendarId(source.getCalendarId());
                event.setSourceId(source.getId());
                event.setExternalKey(item.key());
            }
            event.setTitle(item.title());
            event.setDescription(item.description());
            event.setAllDay(item.allDay());
            event.setStartDate(item.startDate());
            event.setEndDate(item.endDate());
            event.setStartTime(item.startTime());
            event.setEndTime(item.endTime());
            event.setTimeZone(item.timeZone());
            event.setStatus(item.status());
            CalendarEvent saved = events.save(event);
            eventReminders.synchronizeImportedEvent(saved, item.seriesKey());
        }
        existing.values().forEach(event -> {
            eventReminders.deleteForEvent(event);
            events.delete(event);
        });
    }

    public void removeCalendar(String userId, String calendarId) {
        transaction.executeWithoutResult(status -> {
            sources.findByCalendarIdAndUserId(calendarId, userId).ifPresent(source -> {
                events.findAllBySourceId(source.getId()).forEach(event -> {
                    eventReminders.deleteForEvent(event);
                    events.delete(event);
                });
                events.flush();
                eventReminders.deletePreferencesForSource(source.getId());
                sources.delete(source);
                log.info("Calendar source removed: userId={} sourceId={}", userId, source.getId());
            });
            calendars.deleteCalendar(calendarId, userId);
        });
    }

    @Scheduled(fixedDelayString = "${app.calendar-sync.delay-ms:1800000}", initialDelay = 60000)
    public void refreshSubscriptions() {
        refresh(CalendarSource.Type.ICS_URL);
    }

    @Scheduled(cron = "0 0 3 * * *")
    public void refreshFiles() {
        refresh(CalendarSource.Type.ICS_FILE);
    }

    private void refresh(CalendarSource.Type type) {
        for (CalendarSource source : sources.findAllByType(type)) {
            try {
                sync(source.getUserId(), source.getId());
            } catch (Exception exception) {
                log.warn("Calendar source scheduled retry deferred: userId={} sourceId={}: {}",
                        source.getUserId(), source.getId(), exception.getMessage(), exception);
            }
        }
    }
}
