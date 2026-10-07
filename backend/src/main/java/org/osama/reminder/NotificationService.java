package org.osama.reminder;

import lombok.extern.slf4j.Slf4j;
import org.osama.event.CalendarEvent;
import org.osama.event.CalendarEventCancellationRepository;
import org.osama.event.RecurrenceFrequency;
import org.osama.exceptions.ResourceNotFoundException;
import org.osama.mentalstate.MentalStateCheckInRepository;
import org.osama.pomodoro.PomodoroTransition;
import org.osama.scheduling.ScheduledJob;
import org.osama.task.Task;
import org.osama.user.User;
import org.springframework.data.domain.PageRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.DateTimeException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

@Service
@Slf4j
public class NotificationService {
    private static final int PUSH_BATCH_SIZE = 100;
    private static final long CHECKUP_REPEAT_MINUTES = 30;
    private static final long CHECKUP_WINDOW_MINUTES = 30;
    private static final Duration CALENDAR_REMINDER_DELIVERY_GRACE = Duration.ofMinutes(1);
    private static final String USER_DESTINATION = "/queue/notifications";
    public static final String DEFAULT_CHANNEL_ID = "default";
    public static final String CHECKUP_TITLE = "Check-Up";
    public static final String CHECKUP_BODY = "Time to check what your state is.";
    public static final String CHECKUP_TARGET_URL = "/mental-state";

    private final ReminderRepository reminderRepository;
    private final CalendarEventCancellationRepository cancellationRepository;
    private final MentalStateCheckInRepository checkInRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final ExpoPushNotificationService expoPushNotificationService;
    private final WebPushNotificationService webPushNotificationService;

    @Autowired
    public NotificationService(ReminderRepository reminderRepository,
                               CalendarEventCancellationRepository cancellationRepository,
                               MentalStateCheckInRepository checkInRepository,
                               SimpMessagingTemplate messagingTemplate,
                               ExpoPushNotificationService expoPushNotificationService,
                               WebPushNotificationService webPushNotificationService) {
        this.reminderRepository = reminderRepository;
        this.cancellationRepository = cancellationRepository;
        this.checkInRepository = checkInRepository;
        this.messagingTemplate = messagingTemplate;
        this.expoPushNotificationService = expoPushNotificationService;
        this.webPushNotificationService = webPushNotificationService;
    }

    public NotificationService(ReminderRepository reminderRepository,
                               CalendarEventCancellationRepository cancellationRepository,
                               MentalStateCheckInRepository checkInRepository,
                               SimpMessagingTemplate messagingTemplate,
                               ExpoPushNotificationService expoPushNotificationService) {
        this(reminderRepository, cancellationRepository, checkInRepository,
                messagingTemplate, expoPushNotificationService, null);
    }

    @Scheduled(fixedDelayString = "${app.notifications.dispatch-delay-ms:5000}")
    @Transactional
    public void pushDueNotifications() {
        Instant now = Instant.now();
        List<Reminder> due = reminderRepository.lockDueForPush(
                now, PageRequest.of(0, PUSH_BATCH_SIZE));

        for (Reminder reminder : due) {
            if (reminder.getNotificationType() == NotificationType.MEDITATION_COMPLETED) {
                reminder.setAcknowledgedAt(now);
                log.info("Legacy meditation completion notification suppressed: userId={} notificationId={}",
                        reminder.getUserId(), reminder.getReminderId());
                continue;
            }
            if (isCancelledEventReminder(reminder)) {
                if (!scheduleNextRecurringEventReminder(reminder, now)) {
                    reminder.setAcknowledgedAt(now);
                }
                continue;
            }
            Instant deliveryTime = Instant.now();
            if (shouldSkipTaskReminder(reminder, deliveryTime)) {
                reminder.setAcknowledgedAt(deliveryTime);
                log.info("Completed, past, or unscheduled task reminder skipped: userId={} notificationId={} taskId={} scheduledAt={}",
                        reminder.getUserId(), reminder.getReminderId(), reminder.getTaskId(), reminder.getDateTime());
                continue;
            }
            if (shouldSkipCalendarEventReminder(reminder, deliveryTime)) {
                if (!scheduleNextRecurringEventReminder(reminder, deliveryTime)) {
                    reminder.setAcknowledgedAt(deliveryTime);
                }
                log.info("Past or missed calendar event reminder skipped: userId={} notificationId={} eventId={} scheduledAt={}",
                        reminder.getUserId(), reminder.getReminderId(), reminder.getEventId(), reminder.getDateTime());
                continue;
            }
            if (shouldSkipCheckup(reminder, deliveryTime)) {
                reminder.setAcknowledgedAt(deliveryTime);
                log.info("Stale or recently answered check-up notification skipped: userId={} notificationId={} scheduledAt={}",
                        reminder.getUserId(), reminder.getReminderId(), reminder.getDateTime());
                continue;
            }
            String keycloakId = reminder.getUser().getKeycloakId();
            if (keycloakId != null && !keycloakId.isBlank()) {
                messagingTemplate.convertAndSendToUser(
                        keycloakId, USER_DESTINATION, NotificationMessage.from(reminder));
            } else {
                log.warn("WebSocket notification skipped because user has no Keycloak identity: userId={} notificationId={}",
                        reminder.getUserId(), reminder.getReminderId());
            }
            boolean mobilePushAccepted = expoPushNotificationService.send(reminder);
            boolean browserPushAccepted = webPushNotificationService == null
                    || webPushNotificationService.send(reminder);
            // A reminder is claimed permanently after its first delivery attempt. A
            // push service can accept a request even when the response is lost, so
            // retrying an unacknowledged request would create duplicate notifications.
            reminder.setDispatchedAt(deliveryTime);
            if (!mobilePushAccepted || !browserPushAccepted) {
                log.warn("Remote notification delivery was not accepted: userId={} notificationId={} type={}",
                        reminder.getUserId(), reminder.getReminderId(), reminder.getNotificationType());
            }
            log.debug("Notification push attempted: userId={} notificationId={} type={} mobilePushAccepted={} browserPushAccepted={}",
                    reminder.getUserId(), reminder.getReminderId(), reminder.getNotificationType(),
                    mobilePushAccepted, browserPushAccepted);
        }
    }

    @Transactional(readOnly = true)
    public List<NotificationMessage> getDue(String userId) {
        Instant now = Instant.now();
        return reminderRepository.findDueForUser(userId, now).stream()
                .filter(reminder -> reminder.getNotificationType() != NotificationType.MEDITATION_COMPLETED)
                .filter(reminder -> !shouldSkipTaskReminder(reminder, now))
                .filter(reminder -> !shouldSkipCalendarEventReminder(reminder, now))
                .filter(reminder -> !shouldSkipCheckup(reminder, now))
                .map(NotificationMessage::from)
                .toList();
    }

    @Transactional
    public void acknowledge(String notificationId, String userId) {
        Reminder reminder = reminderRepository.findByReminderIdAndUserId(notificationId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Notification not found: " + notificationId));
        if (reminder.getAcknowledgedAt() == null) {
            Instant acknowledgedAt = Instant.now();
            if (scheduleNextCheckupReminder(reminder, acknowledgedAt)) {
                reminder.setAcknowledgedAt(acknowledgedAt);
            } else if (scheduleNextRecurringEventReminder(reminder, acknowledgedAt)) {
                return;
            } else {
                reminder.setAcknowledgedAt(acknowledgedAt);
            }
            log.info("Notification acknowledged: userId={} notificationId={} type={}",
                    userId, notificationId, reminder.getNotificationType());
        }
    }

    private boolean scheduleNextCheckupReminder(Reminder reminder, Instant now) {
        if (reminder.getNotificationType() != NotificationType.MENTAL_STATE_CHECKUP
                || Boolean.FALSE.equals(reminder.getUser().getRepeatCheckupNotificationsEnabled())
                || shouldSkipCheckup(reminder, now)) {
            return false;
        }

        Reminder nextReminder = new Reminder();
        nextReminder.setReminderId("mental-state-checkup-repeat-" + UUID.randomUUID());
        nextReminder.setDateTime(now.plus(CHECKUP_REPEAT_MINUTES, ChronoUnit.MINUTES));
        nextReminder.setRepeat(0);
        nextReminder.setMinutesBefore(0);
        nextReminder.setUser(reminder.getUser());
        nextReminder.setNotificationType(NotificationType.MENTAL_STATE_CHECKUP);
        nextReminder.setTitle(CHECKUP_TITLE);
        nextReminder.setBody(CHECKUP_BODY);
        nextReminder.setTargetUrl(CHECKUP_TARGET_URL);
        reminderRepository.save(nextReminder);
        log.info("Mental state check-up repeat scheduled: userId={} previousNotificationId={} nextNotificationId={} scheduledAt={}",
                reminder.getUser().getId(), reminder.getReminderId(), nextReminder.getReminderId(), nextReminder.getDateTime());
        return true;
    }

    private boolean scheduleNextRecurringEventReminder(Reminder reminder, Instant now) {
        CalendarEvent event = reminder.getEvent();
        if (event == null || event.getRecurrenceFrequency() == null
                || event.getRecurrenceFrequency() == RecurrenceFrequency.NONE
                || event.getStatus() == org.osama.event.CalendarEventStatus.CANCELLED) {
            return false;
        }

        ZoneId zone = ZoneId.of(event.getTimeZone());
        Instant currentOccurrenceStart = reminder.getEventOccurrenceStart();
        if (currentOccurrenceStart == null) {
            currentOccurrenceStart = event.isAllDay()
                    ? event.getStartDate().atStartOfDay(zone).toInstant()
                    : event.getStartTime();
        }

        ZonedDateTime nextOccurrence = currentOccurrenceStart.atZone(zone);
        Instant nextOccurrenceStart;
        Instant effectiveNextOccurrenceStart;
        Instant nextReminderAt;
        do {
            nextOccurrence = nextOccurrence(event, nextOccurrence, zone);
            nextOccurrenceStart = nextOccurrence.toInstant();
            if (event.getRecurrenceEndDate() != null
                    && nextOccurrence.toLocalDate().isAfter(event.getRecurrenceEndDate())) {
                return false;
            }
            effectiveNextOccurrenceStart = effectiveEventOccurrenceStart(event, nextOccurrenceStart);
            nextReminderAt = effectiveNextOccurrenceStart.minusSeconds(reminder.getMinutesBefore() * 60L);
        } while (!effectiveNextOccurrenceStart.isAfter(now)
                || !nextReminderAt.isAfter(now)
                || isCancelledEventOccurrence(event, nextOccurrenceStart));

        String userId = reminder.getUser().getId();
        Reminder nextReminder = new Reminder();
        nextReminder.setReminderId(UUID.randomUUID().toString());
        nextReminder.setUser(reminder.getUser());
        nextReminder.setEvent(event);
        nextReminder.setEventOccurrenceStart(nextOccurrenceStart);
        nextReminder.setDateTime(nextReminderAt);
        nextReminder.setRepeat(0);
        nextReminder.setNotificationType(reminder.getNotificationType());
        nextReminder.setTitle(reminder.getTitle());
        nextReminder.setBody(reminder.getBody());
        nextReminder.setTargetUrl(reminder.getTargetUrl());
        nextReminder.setMinutesBefore(reminder.getMinutesBefore());

        reminderRepository.delete(reminder);
        reminderRepository.flush();
        reminderRepository.save(nextReminder);
        log.info("Recurring calendar reminder advanced: userId={} eventId={} nextReminderId={} occurrenceStart={}",
                userId, event.getId(), nextReminder.getReminderId(), nextOccurrenceStart);
        return true;
    }

    private boolean isCancelledEventReminder(Reminder reminder) {
        CalendarEvent event = reminder.getEvent();
        return event != null && (event.getStatus() == org.osama.event.CalendarEventStatus.CANCELLED
                || isCancelledEventOccurrence(event, reminder.getEventOccurrenceStart()));
    }

    private boolean shouldSkipCalendarEventReminder(Reminder reminder, Instant now) {
        CalendarEvent event = reminder.getEvent();
        if (reminder.getNotificationType() != NotificationType.CALENDAR_EVENT || event == null) {
            return false;
        }

        Instant occurrenceStart = reminder.getEventOccurrenceStart();
        if (occurrenceStart == null) {
            ZoneId zone = ZoneId.of(event.getTimeZone());
            occurrenceStart = event.isAllDay()
                    ? event.getStartDate().atStartOfDay(zone).toInstant()
                    : event.getStartTime();
        }
        Instant effectiveStart = effectiveEventOccurrenceStart(event, occurrenceStart);
        return !effectiveStart.isAfter(now)
                || reminder.getDateTime().isBefore(now.minus(CALENDAR_REMINDER_DELIVERY_GRACE));
    }

    private boolean shouldSkipTaskReminder(Reminder reminder, Instant now) {
        if (reminder.getNotificationType() != NotificationType.TASK_REMINDER || reminder.getTaskId() == null) {
            return false;
        }

        Task task = reminder.getTask();
        if (task == null || task.isCompleted() || task.getScheduledPerformDateTime() == null) {
            return true;
        }

        String taskTimeZone = task.getTimeZone();
        try {
            ZoneId zone = ZoneId.of(taskTimeZone == null || taskTimeZone.isBlank() ? "UTC" : taskTimeZone);
            return !task.getScheduledPerformDateTime().atZone(zone).toInstant().isAfter(now);
        } catch (DateTimeException exception) {
            log.warn("Task reminder skipped because its task has an invalid time zone: userId={} taskId={} timeZone={}",
                    reminder.getUserId(), task.getTaskId(), taskTimeZone, exception);
            return true;
        }
    }

    private boolean isCancelledEventOccurrence(CalendarEvent event, Instant occurrenceStart) {
        if (occurrenceStart == null || event.getRecurrenceFrequency() == null
                || event.getRecurrenceFrequency() == RecurrenceFrequency.NONE) {
            return false;
        }
        String occurrenceKey = eventOccurrenceKey(event, occurrenceStart);
        return cancellationRepository.findByEventIdAndOccurrenceKey(event.getId(), occurrenceKey)
                .map(override -> override.isDeleted()
                        || override.getOccurrenceStatus() == org.osama.event.CalendarEventStatus.CANCELLED)
                .orElse(false);
    }

    private Instant effectiveEventOccurrenceStart(CalendarEvent event, Instant occurrenceStart) {
        String occurrenceKey = eventOccurrenceKey(event, occurrenceStart);
        return cancellationRepository.findByEventIdAndOccurrenceKey(event.getId(), occurrenceKey)
                .map(override -> {
                    if (event.isAllDay() && override.getOverrideStartDate() != null) {
                        return override.getOverrideStartDate()
                                .atStartOfDay(ZoneId.of(event.getTimeZone())).toInstant();
                    }
                    if (!event.isAllDay() && override.getOverrideStartTime() != null) {
                        return override.getOverrideStartTime();
                    }
                    return occurrenceStart;
                })
                .orElse(occurrenceStart);
    }

    private String eventOccurrenceKey(CalendarEvent event, Instant occurrenceStart) {
        if (occurrenceStart == null) return null;
        return event.isAllDay()
                ? "date:" + occurrenceStart.atZone(ZoneId.of(event.getTimeZone())).toLocalDate()
                : "instant:" + occurrenceStart;
    }

    private ZonedDateTime nextOccurrence(CalendarEvent event, ZonedDateTime current, ZoneId zone) {
        return switch (event.getRecurrenceFrequency()) {
            case DAILY -> current.plusDays(1);
            case WEEKLY -> current.plusWeeks(1);
            case MONTHLY -> {
                LocalDate anchorDate = event.isAllDay()
                        ? event.getStartDate()
                        : event.getStartTime().atZone(zone).toLocalDate();
                YearMonth nextMonth = YearMonth.from(current).plusMonths(1);
                LocalDate nextDate = nextMonth.atDay(Math.min(anchorDate.getDayOfMonth(), nextMonth.lengthOfMonth()));
                yield ZonedDateTime.of(nextDate, current.toLocalTime(), zone);
            }
            case CUSTOM -> switch (event.getRecurrenceUnit()) {
                case DAYS -> current.plusDays(event.getRecurrenceInterval());
                case WEEKS -> current.plusWeeks(event.getRecurrenceInterval());
                case MONTHS -> {
                    LocalDate anchorDate = event.isAllDay()
                            ? event.getStartDate()
                            : event.getStartTime().atZone(zone).toLocalDate();
                    YearMonth nextMonth = YearMonth.from(current).plusMonths(event.getRecurrenceInterval());
                    LocalDate nextDate = nextMonth.atDay(Math.min(anchorDate.getDayOfMonth(), nextMonth.lengthOfMonth()));
                    yield ZonedDateTime.of(nextDate, current.toLocalTime(), zone);
                }
            };
            case NONE -> throw new IllegalStateException("A non-recurring event has no next occurrence.");
        };
    }

    public void createPomodoroNotification(ScheduledJob job, String taskName, PomodoroTransition transition) {
        String notificationId = "pomodoro-" + job.getJobId();
        if (reminderRepository.existsById(notificationId)) {
            return;
        }

        Reminder notification = new Reminder();
        notification.setReminderId(notificationId);
        notification.setTaskId(job.getAssociatedTaskId());
        notification.setDateTime(Instant.now());
        notification.setRepeat(0);
        notification.setMinutesBefore(0);
        notification.setUser(job.getUser());
        notification.setTargetUrl("/");
        applyPomodoroCopy(notification, taskName, transition);
        reminderRepository.save(notification);
        log.info("Pomodoro notification persisted: userId={} notificationId={} taskId={} type={}",
                job.getUser().getId(), notificationId, job.getAssociatedTaskId(), notification.getNotificationType());
    }

    @Transactional
    public void createCheckupNotification(User user, ZonedDateTime scheduledAt) {
        Instant scheduledInstant = scheduledAt.toInstant();
        Instant now = Instant.now();
        if (shouldSkipCheckup(user.getId(), scheduledInstant, now)) {
            log.debug("Mental state check-up suppressed after a nearby check-in: userId={} scheduledAt={}",
                    user.getId(), scheduledAt);
            return;
        }

        String zoneKey = Base64.getUrlEncoder().withoutPadding()
                .encodeToString(scheduledAt.getZone().getId().getBytes(StandardCharsets.UTF_8));
        String notificationId = "mental-state-checkup-" + user.getId() + "-"
                + scheduledAt.toLocalDate() + "-" + zoneKey + "-" + String.format("%02d%02d",
                scheduledAt.getHour(), scheduledAt.getMinute());
        if (reminderRepository.existsById(notificationId)) {
            return;
        }

        Reminder notification = new Reminder();
        notification.setReminderId(notificationId);
        notification.setDateTime(scheduledInstant);
        notification.setRepeat(0);
        notification.setMinutesBefore(0);
        notification.setUser(user);
        notification.setNotificationType(NotificationType.MENTAL_STATE_CHECKUP);
        notification.setTitle(CHECKUP_TITLE);
        notification.setBody(CHECKUP_BODY);
        notification.setTargetUrl(CHECKUP_TARGET_URL);
        reminderRepository.save(notification);
        log.info("Mental state check-up notification persisted: userId={} notificationId={} scheduledAt={}",
                user.getId(), notificationId, scheduledAt);
    }

    private boolean shouldSkipCheckup(Reminder reminder, Instant now) {
        if (reminder.getNotificationType() != NotificationType.MENTAL_STATE_CHECKUP) return false;
        return shouldSkipCheckup(reminder.getUser().getId(), reminder.getDateTime(), now);
    }

    private boolean shouldSkipCheckup(String userId, Instant scheduledAt, Instant now) {
        Instant expiresAt = scheduledAt.plus(CHECKUP_WINDOW_MINUTES, ChronoUnit.MINUTES);
        if (!now.isBefore(expiresAt)) return true;

        Instant recentCheckInFrom = scheduledAt.minus(CHECKUP_WINDOW_MINUTES, ChronoUnit.MINUTES);
        return checkInRepository.existsByUserIdAndRecordedAtGreaterThanEqualAndRecordedAtLessThanEqual(
                userId, recentCheckInFrom, scheduledAt)
                || checkInRepository.existsByUserIdAndRecordedAtAfter(userId, scheduledAt);
    }

    @Transactional
    public void clearPendingCheckupNotifications(String userId) {
        int removed = reminderRepository.deletePendingByUserIdAndNotificationType(
                userId, NotificationType.MENTAL_STATE_CHECKUP);
        if (removed > 0) {
            log.info("Pending mental state check-up notifications cleared: userId={} count={}", userId, removed);
        }
    }

    private void applyPomodoroCopy(Reminder notification, String taskName, PomodoroTransition transition) {
        String safeTaskName = taskName == null || taskName.isBlank() ? "Pomodoro task" : taskName;
        switch (transition) {
            case FOCUS_ENDED -> {
                notification.setNotificationType(NotificationType.POMODORO_FOCUS_ENDED);
                notification.setTitle("Focus session complete");
                notification.setBody(safeTaskName + " · Time for a break");
            }
            case BREAK_ENDED -> {
                notification.setNotificationType(NotificationType.POMODORO_BREAK_ENDED);
                notification.setTitle("Break complete");
                notification.setBody(safeTaskName + " · Get back to it");
            }
            case POMODORO_ENDED -> {
                notification.setNotificationType(NotificationType.POMODORO_COMPLETED);
                notification.setTitle("Pomodoro complete");
                notification.setBody(safeTaskName + " · All focus sessions finished");
            }
        }
    }
}
