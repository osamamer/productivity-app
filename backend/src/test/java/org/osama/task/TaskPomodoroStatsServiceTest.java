package org.osama.task;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.osama.requests.NewTaskRequest;
import org.osama.session.task.TaskSession;
import org.osama.session.task.TaskSessionRepository;
import org.osama.user.User;
import org.osama.user.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
@Execution(ExecutionMode.SAME_THREAD)
class TaskPomodoroStatsServiceTest {

    private static final String USER_ID = "task-stats-user";
    private static final String OTHER_USER_ID = "task-stats-other-user";

    @Autowired private TaskService taskService;
    @Autowired private TaskSessionRepository taskSessionRepository;
    @Autowired private UserRepository userRepository;

    @BeforeEach
    void setUp() {
        userRepository.save(user(USER_ID, "task-stats@test.com", "taskstats"));
        userRepository.save(user(OTHER_USER_ID, "task-stats-other@test.com", "taskstatsother"));
    }

    @Test
    void returnsStatsForOwnedTaskAndIgnoresRegularSessions() {
        Task task = createTask(USER_ID, "Write report");
        LocalDate today = LocalDate.now();
        taskSessionRepository.save(session(task.getTaskId(), true, today, 25));
        taskSessionRepository.save(session(task.getTaskId(), true, today.minusDays(1), 10));
        taskSessionRepository.save(session(task.getTaskId(), false, today, 90));

        TaskPomodoroStatsResponse stats = taskService.getPomodoroStats(task.getTaskId(), USER_ID);

        assertEquals(Duration.ofMinutes(35).toSeconds(), stats.totalFocusSeconds());
        assertEquals(2, stats.totalFocusSessions());
        assertEquals(2, stats.totalDaysWorked());
        assertEquals(2, stats.currentStreakDays());
        assertEquals(today, stats.lastWorkedOnDate());
    }

    @Test
    void doesNotExposeStatsForAnotherUsersTask() {
        Task task = createTask(USER_ID, "Private task");

        assertThrows(org.osama.exceptions.ResourceNotFoundException.class,
                () -> taskService.getPomodoroStats(task.getTaskId(), OTHER_USER_ID));
    }

    private Task createTask(String userId, String name) {
        NewTaskRequest request = new NewTaskRequest();
        request.setName(name);
        request.setDescription("");
        request.setScheduledPerformDateTime("");
        return taskService.createTask(request, userId);
    }

    private TaskSession session(String taskId, boolean pomodoro, LocalDate date, long minutes) {
        TaskSession session = new TaskSession();
        session.setSessionId(taskId + "-" + date + "-" + pomodoro);
        session.setAssociatedTaskId(taskId);
        session.setPomodoro(pomodoro);
        session.setActive(false);
        session.setRunning(false);
        session.setTotalSessionTime(Duration.ofMinutes(minutes));
        session.setStartTime(date.atTime(9, 0));
        session.setEndTime(date.atTime(10, 0));
        return session;
    }

    private User user(String id, String email, String username) {
        return User.builder()
                .id(id)
                .email(email)
                .firstName("Task")
                .lastName("Stats")
                .username(username)
                .active(true)
                .build();
    }
}
