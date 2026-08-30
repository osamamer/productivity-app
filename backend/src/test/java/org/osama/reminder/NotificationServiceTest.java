package org.osama.reminder;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.osama.pomodoro.PomodoroTransition;
import org.osama.scheduling.JobType;
import org.osama.scheduling.ScheduledJob;
import org.osama.event.CalendarEventRequest;
import org.osama.event.CalendarEventService;
import org.osama.event.RecurrenceFrequency;
import org.osama.user.User;
import org.osama.user.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestExecutionListeners;
import org.springframework.test.context.support.DependencyInjectionTestExecutionListener;
import org.springframework.test.context.transaction.TransactionalTestExecutionListener;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
@Execution(ExecutionMode.SAME_THREAD)
@TestExecutionListeners(
        listeners = {DependencyInjectionTestExecutionListener.class, TransactionalTestExecutionListener.class},
        mergeMode = TestExecutionListeners.MergeMode.REPLACE_DEFAULTS
)
class NotificationServiceTest {
    private static final String USER_ID = "notification-user";

    @Autowired private NotificationService notificationService;
    @Autowired private ReminderRepository reminderRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private CalendarEventService calendarEventService;

    private User user;

    @BeforeEach
    void setUp() {
        user = userRepository.save(User.builder()
                .id(USER_ID)
                .keycloakId("notification-keycloak-user")
                .email("notifications@example.com")
                .firstName("Notification")
                .lastName("Tester")
                .username("notification-tester")
                .active(true)
                .build());
    }

    @Test
    void pomodoroNotificationSurvivesUntilTheClientAcknowledgesPresentation() {
        notificationService.createPomodoroNotification(
                job("job-1"), "Write reliable reminders", PomodoroTransition.FOCUS_ENDED);

        var due = notificationService.getDue(USER_ID);

        assertEquals(1, due.size());
        assertEquals("pomodoro-job-1", due.get(0).notificationId());
        assertEquals(NotificationType.POMODORO_FOCUS_ENDED, due.get(0).type());
        assertEquals("Write reliable reminders · Time for a break", due.get(0).body());

        notificationService.acknowledge(due.get(0).notificationId(), USER_ID);

        assertTrue(notificationService.getDue(USER_ID).isEmpty());
    }

    @Test
    void repeatedJobHandlingDoesNotCreateDuplicateNotifications() {
        ScheduledJob job = job("same-job");

        notificationService.createPomodoroNotification(job, "Deep work", PomodoroTransition.POMODORO_ENDED);
        notificationService.createPomodoroNotification(job, "Deep work", PomodoroTransition.POMODORO_ENDED);

        assertEquals(1, reminderRepository.findAll().stream()
                .filter(reminder -> reminder.getReminderId().equals("pomodoro-same-job"))
                .count());
    }

    @Test
    void breakCompletionUsesTheReturnToFocusMessage() {
        notificationService.createPomodoroNotification(
                job("break-job"), "Write reliable reminders", PomodoroTransition.BREAK_ENDED);

        var notification = notificationService.getDue(USER_ID).get(0);

        assertEquals(NotificationType.POMODORO_BREAK_ENDED, notification.type());
        assertEquals("Write reliable reminders · Get back to it", notification.body());
    }

    @Test
    void legacyTaskReminderIsDeliveredThroughTheSameInbox() {
        Reminder reminder = new Reminder();
        reminder.setReminderId("task-reminder-1");
        reminder.setNotificationType(NotificationType.TASK_REMINDER);
        reminder.setTitle("Task reminder");
        reminder.setTargetUrl("/tasks");
        reminder.setDateTime(Instant.now().minusSeconds(1));
        reminder.setRepeat(0);
        reminder.setMinutesBefore(0);
        reminder.setUser(user);
        reminderRepository.save(reminder);

        var due = notificationService.getDue(USER_ID);

        assertEquals(1, due.size());
        assertEquals(NotificationType.TASK_REMINDER, due.get(0).type());
        assertEquals("/tasks", due.get(0).targetUrl());
    }

    @Test
    void acknowledgingARecurringCalendarReminderSchedulesItsNextOccurrence() {
        CalendarEventRequest request = new CalendarEventRequest();
        request.setTitle("Weekly planning");
        request.setStartTime(Instant.parse("2027-01-10T10:00:00Z"));
        request.setEndTime(Instant.parse("2027-01-10T11:00:00Z"));
        request.setTimeZone("Asia/Amman");
        request.setRecurrenceFrequency(RecurrenceFrequency.WEEKLY);
        request.setRecurrenceEndDate(LocalDate.of(2027, 2, 28));

        var event = calendarEventService.createEvent(request, USER_ID);
        var reminder = reminderRepository.findByEventId(event.id()).orElseThrow();
        String firstReminderId = reminder.getReminderId();

        notificationService.acknowledge(firstReminderId, USER_ID);

        Reminder nextReminder = reminderRepository.findByEventId(event.id()).orElseThrow();
        assertNotEquals(firstReminderId, nextReminder.getReminderId());
        assertEquals(Instant.parse("2027-01-17T10:00:00Z"), nextReminder.getEventOccurrenceStart());
        assertEquals(Instant.parse("2027-01-17T10:00:00Z").minusSeconds(24 * 60 * 60),
                nextReminder.getDateTime());
    }

    private ScheduledJob job(String jobId) {
        ScheduledJob job = new ScheduledJob();
        job.setJobId(jobId);
        job.setJobType(JobType.END_SESSION);
        job.setAssociatedTaskId(null);
        job.setDueDate(LocalDateTime.now());
        job.setScheduled(false);
        job.setUser(user);
        return job;
    }
}
