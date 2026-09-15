package org.osama;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.osama.day.DayOverviewResponse;
import org.osama.day.DayOverviewService;
import org.osama.task.Task;
import org.osama.task.TaskRepository;
import org.osama.user.User;
import org.osama.user.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
@Execution(ExecutionMode.SAME_THREAD)
class DayOverviewServiceTest {

    private static final String USER_ID = "day-overview-test-user";

    @Autowired private DayOverviewService dayOverviewService;
    @Autowired private TaskRepository taskRepository;
    @Autowired private UserRepository userRepository;

    private User user;

    @BeforeEach
    void setUp() {
        user = userRepository.save(User.builder()
                .id(USER_ID)
                .email("day-overview@test.com")
                .firstName("Day")
                .lastName("Overview")
                .username("dayoverview")
                .active(true)
                .build());
    }

    @Test
    void pastDayShowsCompletionsAndMovesOpenScheduledTasksToTheEnd() {
        LocalDate date = LocalDate.now().minusDays(2);
        LocalDateTime scheduledCompletion = date.atTime(9, 0);
        LocalDateTime completedAt = date.atTime(15, 30);
        LocalDateTime scheduledOpen = date.atTime(10, 0);

        saveTask("completed-task", "Completed task", scheduledCompletion, completedAt, true);
        saveTask("open-task", "Open task", scheduledOpen, null, false);
        saveTask("completed-later", "Completed later", scheduledOpen, date.plusDays(1).atTime(8, 0), true);

        List<DayOverviewResponse.TaskSummary> tasks = dayOverviewService
                .getOverview(date, USER_ID)
                .tasks();

        assertEquals(List.of("Completed task", "Open task"), tasks.stream()
                .map(DayOverviewResponse.TaskSummary::name)
                .toList());
        assertEquals(completedAt, tasks.get(0).completedAt());
        assertEquals(scheduledOpen, tasks.get(1).scheduledAt());
        assertNull(tasks.get(1).completedAt());
    }

    @Test
    void futureDayUsesTheCalendarDayForScheduledTasks() {
        LocalDate date = LocalDate.now().plusDays(2);
        LocalDateTime scheduledAt = date.atTime(1, 30);
        saveTask("future-task", "Future task", scheduledAt, null, false);
        saveTask("unscheduled-task", "Unscheduled task", null, null, false);

        DayOverviewResponse overview = dayOverviewService.getOverview(date, USER_ID);

        assertEquals(date.atStartOfDay(), overview.dayStart());
        assertEquals(date.plusDays(1).atStartOfDay(), overview.dayEnd());
        assertEquals(List.of("Future task"), overview.tasks().stream()
                .map(DayOverviewResponse.TaskSummary::name)
                .toList());
    }

    private Task saveTask(String id, String name, LocalDateTime scheduledAt,
                          LocalDateTime completedAt, boolean completed) {
        Task task = new Task();
        task.setTaskId(id);
        task.setName(name);
        task.setDescription("");
        task.setCreationDateTime(LocalDateTime.now().minusDays(3));
        task.setScheduledPerformDateTime(scheduledAt);
        task.setCompletionDateTime(completedAt);
        task.setCompleted(completed);
        task.setSkipped(false);
        task.setDisplayOrder(0);
        task.setImportance(0);
        task.setUser(user);
        return taskRepository.save(task);
    }
}
