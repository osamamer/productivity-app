package org.osama.reminder;

import lombok.extern.slf4j.Slf4j;
import org.osama.exceptions.ResourceNotFoundException;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Service
@Slf4j
public class ReminderService {
    private final ReminderRepository reminderRepository;
    private final SimpMessagingTemplate messagingTemplate;

    public ReminderService(ReminderRepository reminderRepository, SimpMessagingTemplate messagingTemplate) {
        this.reminderRepository = reminderRepository;
        this.messagingTemplate = messagingTemplate;
    }

    @Scheduled(fixedDelay = 5_000)
    @Transactional
    public void dispatchDueReminders() {
        Instant now = Instant.now();
        for (Reminder reminder : reminderRepository.lockDueUndispatched(now)) {
            ReminderNotification notification = ReminderNotification.from(reminder);
            messagingTemplate.convertAndSendToUser(reminder.getUser().getKeycloakId(),
                    "/queue/reminders", notification);
            reminder.setDispatchedAt(now);
            reminderRepository.save(reminder);
            log.info("Event reminder dispatched: userId={} reminderId={} eventId={}",
                    reminder.getUserId(), reminder.getReminderId(), reminder.getEventId());
        }
    }

    @Transactional(readOnly = true)
    public List<ReminderNotification> getPending(String userId) {
        return reminderRepository.findPendingForUser(userId, Instant.now()).stream()
                .map(ReminderNotification::from)
                .toList();
    }

    @Transactional
    public void acknowledge(String reminderId, String userId) {
        Reminder reminder = reminderRepository.findByReminderIdAndUserId(reminderId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Reminder not found: " + reminderId));
        if (reminder.getAcknowledgedAt() == null) {
            reminder.setAcknowledgedAt(Instant.now());
            reminderRepository.save(reminder);
            log.info("Event reminder acknowledged: userId={} reminderId={} eventId={}",
                    userId, reminderId, reminder.getEventId());
        }
    }
}
