package org.osama.task;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.osama.reminder.NotificationType;
import org.osama.reminder.Reminder;
import org.osama.reminder.ReminderRepository;
import org.osama.requests.NewTaskRequest;
import org.osama.requests.UpdateTaskRequest;
import org.osama.user.User;
import org.osama.user.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
@Execution(ExecutionMode.SAME_THREAD)
class TaskReminderServiceTest {
    private static final String USER_ID = "task-reminder-user";

    @Autowired private TaskService taskService;
    @Autowired private ReminderRepository reminderRepository;
    @Autowired private UserRepository userRepository;

    @BeforeEach
    void setUp() {
        userRepository.save(User.builder()
                .id(USER_ID)
                .keycloakId("task-reminder-keycloak-user")
                .email("task-reminders@example.com")
                .firstName("Task")
                .lastName("Reminder")
                .username("task-reminder")
                .active(true)
                .build());
    }

    @Test
    void scheduledTaskHasNoReminderByDefault() {
        NewTaskRequest request = request("2027-01-10T10:00:00", "Asia/Amman");

        Task task = taskService.createTask(request, USER_ID);

        assertNull(task.getReminderMinutesBefore());
        assertTrue(reminderRepository.findByTaskIdAndNotificationType(
                task.getTaskId(), NotificationType.TASK_REMINDER).isEmpty());
    }

    @Test
    void explicitNullReminderLeavesTheScheduledTaskWithoutOne() {
        NewTaskRequest request = request("2027-01-10T10:00:00", "UTC");
        request.setReminderMinutesBefore(null);

        Task task = taskService.createTask(request, USER_ID);

        assertNull(task.getReminderMinutesBefore());
        assertTrue(reminderRepository.findByTaskIdAndNotificationType(
                task.getTaskId(), NotificationType.TASK_REMINDER).isEmpty());
    }

    @Test
    void updatingReminderReplacesItsDeliveryStateAndReschedulingUsesTheStoredTimeZone() {
        NewTaskRequest initialRequest = request("2027-01-10T10:00:00", "Asia/Amman");
        initialRequest.setReminderMinutesBefore(1440);
        Task task = taskService.createTask(initialRequest, USER_ID);
        String originalReminderId = reminderRepository.findByTaskIdAndNotificationType(
                task.getTaskId(), NotificationType.TASK_REMINDER).orElseThrow().getReminderId();

        UpdateTaskRequest update = new UpdateTaskRequest();
        update.setScheduledPerformDateTime("2027-01-11T12:00:00");
        update.setReminderMinutesBefore(30);
        Task updated = taskService.updateTask(task.getTaskId(), update, USER_ID).orElseThrow();

        Reminder reminder = reminderRepository.findByTaskIdAndNotificationType(
                task.getTaskId(), NotificationType.TASK_REMINDER).orElseThrow();
        assertNotEquals(originalReminderId, reminder.getReminderId());
        assertEquals(30, updated.getReminderMinutesBefore());
        assertEquals(Instant.parse("2027-01-11T08:30:00Z"), reminder.getDateTime());
        assertNull(reminder.getAcknowledgedAt());
        assertNull(reminder.getDispatchedAt());
    }

    private NewTaskRequest request(String scheduledDateTime, String timeZone) {
        NewTaskRequest request = new NewTaskRequest();
        request.setName("Prepare report");
        request.setDescription("Review the latest notes");
        request.setScheduledPerformDateTime(scheduledDateTime);
        request.setTimeZone(timeZone);
        return request;
    }
}
