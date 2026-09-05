package org.osama.reminder;

import lombok.extern.slf4j.Slf4j;
import org.osama.event.CalendarEvent;
import org.osama.event.RecurrenceFrequency;
import org.osama.exceptions.ResourceNotFoundException;
import org.osama.pomodoro.PomodoroTransition;
import org.osama.scheduling.ScheduledJob;
import org.osama.user.User;
import org.springframework.data.domain.PageRequest;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

@Service
@Slf4j
public class NotificationService {
    private static final int PUSH_BATCH_SIZE = 100;
    private static final long PUSH_RETRY_SECONDS = 30;
    private static final String USER_DESTINATION = "/queue/notifications";
    public static final String CHECKUP_TITLE = "Check-Up";
    public static final String CHECKUP_BODY = "Time to check what your state is.";
    public static final String CHECKUP_TARGET_URL = "/mental-state";

    private final ReminderRepository reminderRepository;
    private final SimpMessagingTemplate messagingTemplate;

    public NotificationService(ReminderRepository reminderRepository, SimpMessagingTemplate messagingTemplate) {
        this.reminderRepository = reminderRepository;
        this.messagingTemplate = messagingTemplate;
    }

    @Scheduled(fixedDelayString = "${app.notifications.dispatch-delay-ms:5000}")
    @Transactional
    public void pushDueNotifications() {
        Instant now = Instant.now();
        Instant retryBefore = now.minus(PUSH_RETRY_SECONDS, ChronoUnit.SECONDS);
        List<Reminder> due = reminderRepository.lockDueForPush(
                now, retryBefore, PageRequest.of(0, PUSH_BATCH_SIZE));

        for (Reminder reminder : due) {
            String keycloakId = reminder.getUser().getKeycloakId();
            if (keycloakId == null || keycloakId.isBlank()) {
                reminder.setDispatchedAt(now);
                log.warn("Notification push skipped because user has no Keycloak identity: userId={} notificationId={}",
                        reminder.getUserId(), reminder.getReminderId());
                continue;
            }
            messagingTemplate.convertAndSendToUser(
                    keycloakId, USER_DESTINATION, NotificationMessage.from(reminder));
            reminder.setDispatchedAt(now);
            log.debug("Notification push attempted: userId={} notificationId={} type={}",
                    reminder.getUserId(), reminder.getReminderId(), reminder.getNotificationType());
        }
    }

    @Transactional(readOnly = true)
    public List<NotificationMessage> getDue(String userId) {
        return reminderRepository.findDueForUser(userId, Instant.now()).stream()
                .map(NotificationMessage::from)
                .toList();
    }

    @Transactional
    public void acknowledge(String notificationId, String userId) {
        Reminder reminder = reminderRepository.findByReminderIdAndUserId(notificationId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Notification not found: " + notificationId));
        if (reminder.getAcknowledgedAt() == null) {
            if (scheduleNextRecurringEventReminder(reminder, Instant.now())) {
                return;
            }
            reminder.setAcknowledgedAt(Instant.now());
            log.info("Notification acknowledged: userId={} notificationId={} type={}",
                    userId, notificationId, reminder.getNotificationType());
        }
    }

    private boolean scheduleNextRecurringEventReminder(Reminder reminder, Instant now) {
        CalendarEvent event = reminder.getEvent();
        if (event == null || event.getRecurrenceFrequency() == null
                || event.getRecurrenceFrequency() == RecurrenceFrequency.NONE) {
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
        do {
            nextOccurrence = nextOccurrence(event, nextOccurrence, zone);
            if (event.getRecurrenceEndDate() != null
                    && nextOccurrence.toLocalDate().isAfter(event.getRecurrenceEndDate())) {
                return false;
            }
        } while (!nextOccurrence.toInstant().isAfter(now));

        String userId = reminder.getUser().getId();
        Reminder nextReminder = new Reminder();
        nextReminder.setReminderId(UUID.randomUUID().toString());
        nextReminder.setUser(reminder.getUser());
        nextReminder.setEvent(event);
        nextReminder.setEventOccurrenceStart(nextOccurrence.toInstant());
        nextReminder.setDateTime(nextOccurrence.toInstant()
                .minusSeconds(reminder.getMinutesBefore() * 60L));
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
                userId, event.getId(), nextReminder.getReminderId(), nextOccurrence.toInstant());
        return true;
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
        String notificationId = "mental-state-checkup-" + user.getId() + "-"
                + scheduledAt.toLocalDate() + "-" + String.format("%02d%02d",
                scheduledAt.getHour(), scheduledAt.getMinute());
        if (reminderRepository.existsById(notificationId)) {
            return;
        }

        Reminder notification = new Reminder();
        notification.setReminderId(notificationId);
        notification.setDateTime(scheduledAt.toInstant());
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
