package org.osama.reminder;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.osama.mentalstate.MentalStateCheckInRepository;
import org.osama.event.CalendarEventCancellationRepository;
import org.osama.user.User;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.any;

@ExtendWith(MockitoExtension.class)
class NotificationServiceRepeatTest {
    private static final String USER_ID = "repeat-user";

    @Mock
    private ReminderRepository reminderRepository;

    @Mock
    private CalendarEventCancellationRepository cancellationRepository;

    @Mock
    private MentalStateCheckInRepository checkInRepository;

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @Mock
    private ExpoPushNotificationService expoPushNotificationService;

    private NotificationService notificationService;
    private User user;

    @BeforeEach
    void setUp() {
        notificationService = new NotificationService(
                reminderRepository, cancellationRepository, checkInRepository, messagingTemplate,
                expoPushNotificationService);
        user = User.builder()
                .id(USER_ID)
                .keycloakId("repeat-keycloak-user")
                .email("repeat@example.com")
                .firstName("Repeat")
                .lastName("Tester")
                .username("repeat-tester")
                .active(true)
                .build();
    }

    @Test
    void schedulesAnotherCheckupThirtyMinutesAfterAnUnansweredCheckup() {
        Instant scheduledAt = Instant.now().minusSeconds(60);
        Reminder reminder = checkupReminder(scheduledAt);
        when(reminderRepository.findByReminderIdAndUserId("checkup-1", USER_ID))
                .thenReturn(Optional.of(reminder));
        when(checkInRepository.existsByUserIdAndRecordedAtAfter(USER_ID, scheduledAt)).thenReturn(false);

        Instant beforeAcknowledgement = Instant.now();
        notificationService.acknowledge("checkup-1", USER_ID);

        ArgumentCaptor<Reminder> nextReminder = ArgumentCaptor.forClass(Reminder.class);
        verify(reminderRepository).save(nextReminder.capture());
        assertEquals(NotificationType.MENTAL_STATE_CHECKUP, nextReminder.getValue().getNotificationType());
        assertTrue(nextReminder.getValue().getDateTime().isAfter(beforeAcknowledgement.plusSeconds(29 * 60)));
        assertTrue(nextReminder.getValue().getDateTime().isBefore(beforeAcknowledgement.plusSeconds(31 * 60)));
        assertNotNull(reminder.getAcknowledgedAt());
    }

    @Test
    void doesNotRepeatWhenTheUserTurnsThePreferenceOff() {
        user.setRepeatCheckupNotificationsEnabled(false);
        Reminder reminder = checkupReminder(Instant.now().minusSeconds(60));
        when(reminderRepository.findByReminderIdAndUserId("checkup-1", USER_ID))
                .thenReturn(Optional.of(reminder));

        notificationService.acknowledge("checkup-1", USER_ID);

        verify(reminderRepository, never()).save(org.mockito.ArgumentMatchers.any(Reminder.class));
        assertNotNull(reminder.getAcknowledgedAt());
    }

    @Test
    void doesNotRepeatWhenTheUserHasCheckedInSinceTheNotification() {
        Instant scheduledAt = Instant.now().minusSeconds(60);
        Reminder reminder = checkupReminder(scheduledAt);
        when(reminderRepository.findByReminderIdAndUserId("checkup-1", USER_ID))
                .thenReturn(Optional.of(reminder));
        when(checkInRepository.existsByUserIdAndRecordedAtAfter(USER_ID, scheduledAt)).thenReturn(true);

        notificationService.acknowledge("checkup-1", USER_ID);

        verify(reminderRepository, never()).save(org.mockito.ArgumentMatchers.any(Reminder.class));
        assertNotNull(reminder.getAcknowledgedAt());
    }

    @Test
    void dispatchesEveryNotificationTypeThroughExpo() {
        List<Reminder> reminders = Arrays.stream(NotificationType.values())
                .map(this::reminderOfType)
                .toList();
        when(reminderRepository.lockDueForPush(any(Instant.class), any())).thenReturn(reminders);
        when(expoPushNotificationService.send(any(Reminder.class))).thenReturn(true);

        notificationService.pushDueNotifications();

        reminders.forEach(reminder -> {
            verify(expoPushNotificationService).send(reminder);
            assertNotNull(reminder.getDispatchedAt());
        });
    }

    @Test
    void remoteDeliveryDoesNotDependOnWebSocketIdentity() {
        user.setKeycloakId(null);
        Reminder reminder = reminderOfType(NotificationType.TASK_REMINDER);
        when(reminderRepository.lockDueForPush(any(Instant.class), any())).thenReturn(List.of(reminder));
        when(expoPushNotificationService.send(reminder)).thenReturn(true);

        notificationService.pushDueNotifications();

        verify(expoPushNotificationService).send(reminder);
    }

    private Reminder checkupReminder(Instant scheduledAt) {
        Reminder reminder = new Reminder();
        reminder.setReminderId("checkup-1");
        reminder.setDateTime(scheduledAt);
        reminder.setRepeat(0);
        reminder.setMinutesBefore(0);
        reminder.setUser(user);
        reminder.setNotificationType(NotificationType.MENTAL_STATE_CHECKUP);
        return reminder;
    }

    private Reminder reminderOfType(NotificationType type) {
        Reminder reminder = new Reminder();
        reminder.setReminderId("notification-" + type.name());
        reminder.setDateTime(Instant.now().minusSeconds(1));
        reminder.setRepeat(0);
        reminder.setMinutesBefore(0);
        reminder.setNotificationType(type);
        reminder.setTitle(type.name());
        reminder.setBody(type.name());
        reminder.setTargetUrl("/");
        reminder.setUser(user);
        return reminder;
    }
}
