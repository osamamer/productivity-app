package org.osama.event;

import lombok.extern.slf4j.Slf4j;
import org.osama.exceptions.ResourceNotFoundException;
import org.osama.reminder.Reminder;
import org.osama.reminder.ReminderRepository;
import org.osama.reminder.NotificationType;
import org.osama.user.User;
import org.osama.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DateTimeException;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;

@Service
@Slf4j
public class CalendarEventService {
    public static final int DEFAULT_REMINDER_MINUTES = 24 * 60;
    private static final int MAX_REMINDER_MINUTES = 8 * 7 * 24 * 60;

    private final CalendarEventRepository eventRepository;
    private final ReminderRepository reminderRepository;
    private final UserRepository userRepository;

    public CalendarEventService(CalendarEventRepository eventRepository,
                                ReminderRepository reminderRepository,
                                UserRepository userRepository) {
        this.eventRepository = eventRepository;
        this.reminderRepository = reminderRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public List<CalendarEventResponse> getEvents(String userId) {
        return eventRepository.findAllByUserIdOrderByStartDateAscStartTimeAsc(userId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public CalendarEventResponse createEvent(CalendarEventRequest request, String userId) {
        User user = userRepository.findUserById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));
        CalendarEvent event = new CalendarEvent();
        event.setId(UUID.randomUUID().toString());
        event.setUser(user);
        applyRequest(event, request);
        CalendarEvent saved = eventRepository.save(event);
        replaceReminder(saved, requestedReminderMinutes(request), user);
        log.info("Calendar event created: userId={} eventId={} allDay={} reminderMinutesBefore={}",
                userId, saved.getId(), saved.isAllDay(), requestedReminderMinutes(request));
        return toResponse(saved);
    }

    @Transactional
    public CalendarEventResponse updateEvent(String eventId, CalendarEventRequest request, String userId) {
        CalendarEvent event = eventRepository.findByIdAndUserId(eventId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Calendar event not found: " + eventId));
        applyRequest(event, request);
        CalendarEvent saved = eventRepository.save(event);
        Integer reminderMinutes = requestedReminderMinutes(request);
        replaceReminder(saved, reminderMinutes, event.getUser());
        log.info("Calendar event updated: userId={} eventId={} allDay={} reminderMinutesBefore={}",
                userId, eventId, saved.isAllDay(), reminderMinutes);
        return toResponse(saved);
    }

    @Transactional
    public void deleteEvent(String eventId, String userId) {
        CalendarEvent event = eventRepository.findByIdAndUserId(eventId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Calendar event not found: " + eventId));
        eventRepository.delete(event);
        log.info("Calendar event deleted: userId={} eventId={}", userId, eventId);
    }

    private void applyRequest(CalendarEvent event, CalendarEventRequest request) {
        String title = request.getTitle() == null ? "" : request.getTitle().trim();
        if (title.isEmpty() || title.length() > 200) {
            throw new IllegalArgumentException("Event title must contain between 1 and 200 characters.");
        }

        String timeZone = request.getTimeZone();
        try {
            ZoneId.of(timeZone == null || timeZone.isBlank() ? "UTC" : timeZone);
        } catch (DateTimeException e) {
            throw new IllegalArgumentException("Event time zone is invalid.", e);
        }

        if (request.isAllDay()) {
            if (request.getStartDate() == null || request.getEndDate() == null
                    || request.getEndDate().isBefore(request.getStartDate())) {
                throw new IllegalArgumentException("An all-day event needs a valid start and finish date.");
            }
        } else if (request.getStartTime() == null || request.getEndTime() == null
                || !request.getEndTime().isAfter(request.getStartTime())) {
            throw new IllegalArgumentException("A timed event needs a finish time after its start time.");
        }

        event.setTitle(title);
        event.setDescription(request.getDescription() == null ? "" : request.getDescription().trim());
        event.setAllDay(request.isAllDay());
        event.setTimeZone(timeZone == null || timeZone.isBlank() ? "UTC" : timeZone);
        event.setStartDate(request.isAllDay() ? request.getStartDate() : null);
        event.setEndDate(request.isAllDay() ? request.getEndDate() : null);
        event.setStartTime(request.isAllDay() ? null : request.getStartTime());
        event.setEndTime(request.isAllDay() ? null : request.getEndTime());
    }

    private Integer requestedReminderMinutes(CalendarEventRequest request) {
        Integer minutes = request.getReminderMinutesBefore();
        if (!request.isReminderMinutesBeforePresent()) {
            minutes = DEFAULT_REMINDER_MINUTES;
        }
        if (minutes != null && (minutes < 0 || minutes > MAX_REMINDER_MINUTES)) {
            throw new IllegalArgumentException("Reminder must be between the event start and eight weeks before it.");
        }
        return minutes;
    }

    private void replaceReminder(CalendarEvent event, Integer minutesBefore, User user) {
        var existingReminder = reminderRepository.findByEventId(event.getId());
        existingReminder.ifPresent(reminderRepository::delete);
        if (minutesBefore == null) {
            return;
        }

        if (existingReminder.isPresent()) {
            reminderRepository.flush();
        }

        Instant eventStart = event.isAllDay()
                ? event.getStartDate().atStartOfDay(ZoneId.of(event.getTimeZone())).toInstant()
                : event.getStartTime();
        Reminder reminder = new Reminder();
        reminder.setReminderId(UUID.randomUUID().toString());
        reminder.setRepeat(0);
        reminder.setUser(user);
        reminder.setEvent(event);
        reminder.setNotificationType(NotificationType.CALENDAR_EVENT);
        reminder.setTargetUrl("/calendar");
        reminder.setDateTime(eventStart.minusSeconds(minutesBefore.longValue() * 60));
        reminder.setMinutesBefore(minutesBefore);
        reminder.setDispatchedAt(null);
        reminder.setAcknowledgedAt(null);
        reminderRepository.save(reminder);
    }

    private CalendarEventResponse toResponse(CalendarEvent event) {
        Integer reminderMinutes = reminderRepository.findByEventId(event.getId())
                .map(Reminder::getMinutesBefore)
                .orElse(null);
        return new CalendarEventResponse(event.getId(), event.getTitle(), event.getDescription(),
                event.isAllDay(), event.getStartDate(), event.getEndDate(), event.getStartTime(),
                event.getEndTime(), event.getTimeZone(), reminderMinutes,
                event.getCreatedAt(), event.getUpdatedAt());
    }
}
