package org.osama.reminder;

import lombok.extern.slf4j.Slf4j;
import org.osama.exceptions.ResourceNotFoundException;
import org.osama.pomodoro.PomodoroTransition;
import org.osama.scheduling.ScheduledJob;
import org.springframework.data.domain.PageRequest;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Service
@Slf4j
public class NotificationService {
    private static final int PUSH_BATCH_SIZE = 100;
    private static final long PUSH_RETRY_SECONDS = 30;
    private static final String USER_DESTINATION = "/queue/notifications";

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
            reminder.setAcknowledgedAt(Instant.now());
            log.info("Notification acknowledged: userId={} notificationId={} type={}",
                    userId, notificationId, reminder.getNotificationType());
        }
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
