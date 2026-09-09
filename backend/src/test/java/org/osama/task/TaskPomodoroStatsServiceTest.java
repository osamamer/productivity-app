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
import java.time.LocalDateTime;
import java.util.Map;

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
    @Autowired private TaskRepository taskRepository;

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

    @Test
    void sumsTodayFocusAcrossOwnedTasks() {
        Task firstTask = createTask(USER_ID, "Write report");
        Task secondTask = createTask(USER_ID, "Review report");
        Task otherUsersTask = createTask(OTHER_USER_ID, "Private report");
        LocalDate today = LocalDate.now();

        taskSessionRepository.save(session(firstTask.getTaskId(), true, today, 25));
        taskSessionRepository.save(session(secondTask.getTaskId(), true, today, 40));
        taskSessionRepository.save(session(firstTask.getTaskId(), true, today.minusDays(1), 100));
        taskSessionRepository.save(session(secondTask.getTaskId(), false, today, 90));
        taskSessionRepository.save(session(otherUsersTask.getTaskId(), true, today, 60));

        TodayFocusSummaryResponse summary = taskService.getTodayFocusSummary(USER_ID, today);

        assertEquals(Duration.ofMinutes(65).toSeconds(), summary.totalFocusSeconds());
        assertEquals(today, summary.date());
    }

    @Test
    void groupsRecurringTaskFocusByOccurrenceDateAndIncludesUnfocusedOccurrences() {
        LocalDate today = LocalDate.now();
        String seriesId = "focus-series";
        Task olderOccurrence = recurringOccurrence(USER_ID, seriesId, today.minusDays(2));
        Task previousOccurrence = recurringOccurrence(USER_ID, seriesId, today.minusDays(1));
        Task currentOccurrence = recurringOccurrence(USER_ID, seriesId, today);

        taskSessionRepository.save(session(previousOccurrence.getTaskId(), true, today.minusDays(1), 10));
        taskSessionRepository.save(session(currentOccurrence.getTaskId(), true, today, 25));
        taskSessionRepository.save(session(olderOccurrence.getTaskId(), false, today.minusDays(2), 90));

        Map<LocalDate, Long> focusByDate = taskService.getPomodoroFocusTimeForSeries(
                seriesId, today.minusDays(2), today, USER_ID);

        assertEquals(Map.of(
                today.minusDays(2), 0L,
                today.minusDays(1), Duration.ofMinutes(10).toSeconds(),
                today, Duration.ofMinutes(25).toSeconds()), focusByDate);
    }

    private Task createTask(String userId, String name) {
        NewTaskRequest request = new NewTaskRequest();
        request.setName(name);
        request.setDescription("");
        request.setScheduledPerformDateTime("");
        return taskService.createTask(request, userId);
    }

    private Task recurringOccurrence(String userId, String seriesId, LocalDate date) {
        Task task = createTask(userId, "Recurring focus");
        task.setTaskSeriesId(seriesId);
        task.setSeriesOccurrenceAt(LocalDateTime.of(date, java.time.LocalTime.NOON));
        return taskRepository.save(task);
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
