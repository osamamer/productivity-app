package org.osama;

import org.junit.jupiter.api.Test;
import org.osama.day.DayService;
import org.osama.task.requests.NewTaskRequest;
import org.osama.task.Task;
import org.osama.task.TaskRepository;
import org.osama.task.TaskService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.InvalidDataAccessApiUsageException;

import static org.junit.jupiter.api.Assertions.*;


@SpringBootTest
public class EndToEndTest {
    @Autowired
    private TaskService taskService;
    @Autowired
    private TaskRepository taskRepository;
    @Autowired
    private DayService dayService;
    @Test
    void createNewTask() {
        Task task = createTask();
        assertDoesNotThrow(() -> taskRepository.getTaskById(task.getTaskId()));
        assertThrows(InvalidDataAccessApiUsageException.class, () -> taskRepository.getTaskById("INVALID_ID"));
    }

    @Test
    void startAndEndSession() {
        Task task = createTask();
        assertDoesNotThrow(() -> taskService.startTaskSession(task.getTaskId()));
        assertDoesNotThrow(() -> taskService.endTaskSession(task.getTaskId()));
    }
    @Test
    void pauseAndUnpauseSession() {
        Task task = createTask();
        taskService.startTaskSession(task.getTaskId());
        assertDoesNotThrow(() -> taskService.pauseTaskSession(task.getTaskId()));
        assertDoesNotThrow(() -> taskService.unpauseTaskSession(task.getTaskId()));
    }
    @Test
    void startAlreadyRunningSession() {
        Task task = createTask();
        taskService.startTaskSession(task.getTaskId());
        assertThrows(IllegalStateException.class, () -> taskService.startTaskSession(task.getTaskId()));
    }
    @Test
    void unpauseAlreadyRunningSession() {
        Task task = createTask();
        taskService.startTaskSession(task.getTaskId());
        assertThrows(IllegalStateException.class, () -> taskService.unpauseTaskSession(task.getTaskId()));
    }
    @Test
    void endNotRunningTask() {
        Task task = createTask();
        assertThrows(IllegalStateException.class, () -> taskService.endTaskSession(task.getTaskId()));
    }
    @Test
    void pauseNotRunningTask() {
        Task task = createTask();
        assertThrows(IllegalStateException.class, () -> taskService.pauseTaskSession(task.getTaskId()));
    }
    @Test
    void setDaySummary() {
        dayService.setDaySummary("2024-02-15", "It was a shit day.");
    }
    @Test
    void setTodayRating() {
        dayService.setTodayRating(5);
    }
    public Task createTask() {
        NewTaskRequest taskRequest = new NewTaskRequest();
        taskRequest.setTaskName("Do chores");
        taskRequest.setTaskDescription("Vacuum nasty room");
        taskRequest.setTaskPerformTime("2025-01-13T17:09:42.411");
        return taskService.createNewTask(taskRequest);
    }

}
