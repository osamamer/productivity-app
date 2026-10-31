package org.osama.event;

import lombok.extern.slf4j.Slf4j;
import org.osama.calendar.CalendarSource;
import org.osama.calendar.CalendarSourceRepository;
import org.osama.calendar.IcsCalendarParser;
import org.osama.calendar.ImportedCalendarEvent;
import org.osama.exceptions.ResourceNotFoundException;
import org.osama.reminder.NotificationType;
import org.osama.reminder.Reminder;
import org.osama.reminder.ReminderRepository;
import org.osama.user.User;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.*;

@Service
@Slf4j
public class CalendarEventReminderService {
    private static final int MAX_REMINDER_MINUTES = 8 * 7 * 24 * 60;
    private static final long MISSED_REMINDER_MARKER_AGE_SECONDS = 120;

    private final ReminderRepository reminders;
    private final CalendarEventReminderPreferenceRepository preferences;
    private final CalendarEventRepository events;
    private final CalendarSourceRepository sources;
    private final IcsCalendarParser parser;

    public CalendarEventReminderService(ReminderRepository reminders,
                                        CalendarEventReminderPreferenceRepository preferences,
                                        CalendarEventRepository events,
                                        CalendarSourceRepository sources,
                                        IcsCalendarParser parser) {
        this.reminders = reminders;
        this.preferences = preferences;
        this.events = events;
        this.sources = sources;
        this.parser = parser;
    }

    public void replaceReminder(CalendarEvent event, Integer minutesBefore, User user) {
        var existing = reminders.findByEventId(event.getId());
        existing.ifPresent(reminders::delete);
        if (minutesBefore == null) return;
        if (existing.isPresent()) reminders.flush();

        Instant eventStart = eventStart(event);
        Instant now = Instant.now();
        Instant reminderAt = eventStart.minusSeconds(minutesBefore.longValue() * 60);
        boolean reminderWindowMissed = !eventStart.isAfter(now) || !reminderAt.isAfter(now);
        boolean recurring = event.getRecurrenceFrequency() != RecurrenceFrequency.NONE;
        if (!recurring && reminderWindowMissed) return;

        reminders.save(newReminder(event, minutesBefore, user, eventStart,
                recurring && reminderWindowMissed
                        ? now.minusSeconds(MISSED_REMINDER_MARKER_AGE_SECONDS)
                        : reminderAt));
    }

    public List<CalendarEvent> setImportedEventReminder(CalendarEvent event, Integer minutesBefore,
                                                        CalendarEventReminderScope scope, String userId) {
        if (event.getSourceId() == null) {
            throw new IllegalArgumentException("Only imported events use this reminder action.");
        }
        CalendarEventReminderScope reminderScope = scope == null ? CalendarEventReminderScope.EVENT : scope;
        SeriesMembers series = resolveSeries(event, userId);
        if (minutesBefore != null) validateReminderTime(event, minutesBefore);

        if (reminderScope == CalendarEventReminderScope.EVENT) {
            savePreference(event.getSourceId(), series.seriesKey(), event.getExternalKey(), minutesBefore);
            applyReminder(event, minutesBefore);
            return List.of(event);
        }

        if (minutesBefore == null) {
            preferences.findBySourceIdAndSeriesKeyAndExternalKeyIsNull(event.getSourceId(), series.seriesKey())
                    .ifPresent(preferences::delete);
            preferences.softDeleteOccurrencePreferences(event.getSourceId(), series.seriesKey());
            series.events().forEach(this::deleteForEvent);
            return series.events();
        }

        savePreference(event.getSourceId(), series.seriesKey(), null, minutesBefore);
        preferences.softDeleteOccurrencePreferences(event.getSourceId(), series.seriesKey());
        series.events().forEach(member -> applyReminder(member, minutesBefore));
        return series.events();
    }

    public void synchronizeImportedEvent(CalendarEvent event, String seriesKey) {
        if (event.getSourceId() == null) return;
        Reminder reminder = reminders.findByEventId(event.getId()).orElse(null);
        CalendarEventReminderPreference occurrencePreference = preferences
                .findBySourceIdAndExternalKey(event.getSourceId(), event.getExternalKey()).orElse(null);
        CalendarEventReminderPreference seriesPreference = occurrencePreference == null
                ? preferences.findBySourceIdAndSeriesKeyAndExternalKeyIsNull(event.getSourceId(), seriesKey)
                    .orElse(null)
                : null;
        Integer minutesBefore = occurrencePreference != null
                ? occurrencePreference.getMinutesBefore()
                : seriesPreference != null ? seriesPreference.getMinutesBefore()
                : reminder == null ? null : reminder.getMinutesBefore();
        if (occurrencePreference != null && minutesBefore == null) {
            if (reminder != null) deleteReminder(reminder, event, "explicit event preference");
            return;
        }
        if (minutesBefore == null && reminder == null) return;
        if (minutesBefore == null) minutesBefore = reminder.getMinutesBefore();

        Instant eventStart = eventStart(event);
        Instant reminderAt = eventStart.minusSeconds(minutesBefore * 60L);
        Instant now = Instant.now();
        if (event.getStatus() == CalendarEventStatus.CANCELLED
                || !eventStart.isAfter(now) || !reminderAt.isAfter(now)) {
            if (reminder != null) {
                deleteReminder(reminder, event, "event is no longer upcoming");
            }
            return;
        }

        if (reminder == null) {
            reminders.save(newReminder(event, minutesBefore, event.getUser(), eventStart, reminderAt));
            return;
        }

        boolean eventMoved = !Objects.equals(reminder.getEventOccurrenceStart(), eventStart)
                || reminder.getMinutesBefore() != minutesBefore;
        if (eventMoved) {
            User user = reminder.getUser();
            deleteReminder(reminder, event, "event details changed");
            reminders.flush();
            reminders.save(newReminder(event, minutesBefore, user, eventStart, reminderAt));
            log.info("Imported calendar event reminder rescheduled: userId={} eventId={} minutesBefore={} reminderAt={}",
                    event.getUserId(), event.getId(), minutesBefore, reminderAt);
            return;
        }

        reminder.setDateTime(reminderAt);
        reminder.setEventOccurrenceStart(eventStart);
        reminder.setTitle(event.getTitle());
        reminder.setBody("Event reminder");
        reminder.setTargetUrl("/calendar");
        reminders.save(reminder);
    }

    public void deleteForEvent(CalendarEvent event) {
        reminders.findByEventId(event.getId())
                .ifPresent(reminder -> deleteReminder(reminder, event, "source event was removed"));
        if (event.getSourceId() != null && event.getExternalKey() != null) {
            preferences.findBySourceIdAndExternalKey(event.getSourceId(), event.getExternalKey())
                    .ifPresent(preferences::delete);
        }
    }

    public void deletePreferencesForSource(String sourceId) {
        preferences.softDeleteBySourceId(sourceId);
    }

    public Integer minutesBefore(String eventId) {
        return reminders.findByEventId(eventId).map(Reminder::getMinutesBefore).orElse(null);
    }

    private Instant eventStart(CalendarEvent event) {
        return event.isAllDay()
                ? event.getStartDate().atStartOfDay(ZoneId.of(event.getTimeZone())).toInstant()
                : event.getStartTime();
    }

    private void validateReminderTime(CalendarEvent event, int minutesBefore) {
        if (minutesBefore < 0 || minutesBefore > MAX_REMINDER_MINUTES) {
            throw new IllegalArgumentException("Reminder must be between the event start and eight weeks before it.");
        }
        if (event.getStatus() == CalendarEventStatus.CANCELLED) {
            throw new IllegalArgumentException("Cancelled events cannot have reminders.");
        }
        Instant eventStart = eventStart(event);
        Instant reminderAt = eventStart.minusSeconds(minutesBefore * 60L);
        Instant now = Instant.now();
        if (!eventStart.isAfter(now) || !reminderAt.isAfter(now)) {
            throw new IllegalArgumentException("This event is too close to set that reminder.");
        }
    }

    private void applyReminder(CalendarEvent event, Integer minutesBefore) {
        if (minutesBefore == null || event.getStatus() == CalendarEventStatus.CANCELLED) {
            reminders.findByEventId(event.getId())
                    .ifPresent(reminder -> deleteReminder(reminder, event, "reminder preference was cleared"));
            return;
        }
        Instant eventStart = eventStart(event);
        Instant reminderAt = eventStart.minusSeconds(minutesBefore * 60L);
        Instant now = Instant.now();
        if (!eventStart.isAfter(now) || !reminderAt.isAfter(now)) {
            reminders.findByEventId(event.getId())
                    .ifPresent(reminder -> deleteReminder(reminder, event, "reminder time has passed"));
            return;
        }
        replaceReminder(event, minutesBefore, event.getUser());
    }

    private void savePreference(String sourceId, String seriesKey, String externalKey, Integer minutesBefore) {
        CalendarEventReminderPreference preference = externalKey == null
                ? preferences.findBySourceIdAndSeriesKeyAndExternalKeyIsNull(sourceId, seriesKey).orElse(null)
                : preferences.findBySourceIdAndExternalKey(sourceId, externalKey).orElse(null);
        if (preference == null) {
            preference = new CalendarEventReminderPreference();
            preference.setId(UUID.randomUUID().toString());
            preference.setSourceId(sourceId);
            preference.setSeriesKey(seriesKey);
            preference.setExternalKey(externalKey);
        }
        preference.setMinutesBefore(minutesBefore);
        preferences.save(preference);
    }

    private SeriesMembers resolveSeries(CalendarEvent event, String userId) {
        CalendarSource source = sources.findByIdAndUserId(event.getSourceId(), userId)
                .orElseThrow(() -> new ResourceNotFoundException("Calendar source not found."));
        List<ImportedCalendarEvent> imported = parser.parse(
                source.getSourcePayload(), LocalDate.now(ZoneOffset.UTC));
        ImportedCalendarEvent selected = imported.stream()
                .filter(item -> item.key().equals(event.getExternalKey()))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("This event is no longer in its calendar."));
        Set<String> occurrenceKeys = imported.stream()
                .filter(item -> item.seriesKey().equals(selected.seriesKey()))
                .map(ImportedCalendarEvent::key)
                .collect(java.util.stream.Collectors.toSet());
        List<CalendarEvent> members = events.findAllBySourceId(event.getSourceId()).stream()
                .filter(candidate -> occurrenceKeys.contains(candidate.getExternalKey()))
                .toList();
        if (members.stream().noneMatch(member -> member.getId().equals(event.getId()))) {
            throw new IllegalArgumentException("This event is no longer in its calendar.");
        }
        return new SeriesMembers(selected.seriesKey(), members);
    }

    private void deleteReminder(Reminder reminder, CalendarEvent event, String reason) {
        reminders.delete(reminder);
        log.info("Imported calendar event reminder removed: userId={} eventId={} reason={}",
                event.getUserId(), event.getId(), reason);
    }

    private record SeriesMembers(String seriesKey, List<CalendarEvent> events) {
    }

    private Reminder newReminder(CalendarEvent event, int minutesBefore, User user,
                                 Instant eventStart, Instant reminderAt) {
        Reminder reminder = new Reminder();
        reminder.setReminderId(UUID.randomUUID().toString());
        reminder.setRepeat(0);
        reminder.setUser(user);
        reminder.setEvent(event);
        reminder.setNotificationType(NotificationType.CALENDAR_EVENT);
        reminder.setTitle(event.getTitle());
        reminder.setBody("Event reminder");
        reminder.setTargetUrl("/calendar");
        reminder.setDateTime(reminderAt);
        reminder.setEventOccurrenceStart(eventStart);
        reminder.setMinutesBefore(minutesBefore);
        return reminder;
    }
}
