package org.osama;

import org.junit.jupiter.api.Test;
import org.osama.day.DayService;
import org.osama.task.NewTaskRequest;
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
        assertDoesNotThrow(() -> taskRepository.getTaskById(task.getId()));
        assertThrows(InvalidDataAccessApiUsageException.class, () -> taskRepository.getTaskById("INVALID_ID"));
    }

    @Test
    void startAndEndSession() {
        Task task = createTask();
        assertDoesNotThrow(() -> taskService.startTaskSession(task.getId()));
        assertDoesNotThrow(() -> taskService.endTaskSession(task.getId()));
    }
    @Test
    void pauseAndUnpauseSession() {
        Task task = createTask();
        taskService.startTaskSession(task.getId());
        assertDoesNotThrow(() -> taskService.pauseTaskSession(task.getId()));
        assertDoesNotThrow(() -> taskService.unpauseTaskSession(task.getId()));
    }
    @Test
    void startAlreadyRunningSession() {
        Task task = createTask();
        taskService.startTaskSession(task.getId());
        assertThrows(IllegalStateException.class, () -> taskService.startTaskSession(task.getId()));
    }
    @Test
    void unpauseAlreadyRunningSession() {
        Task task = createTask();
        taskService.startTaskSession(task.getId());
        assertThrows(IllegalStateException.class, () -> taskService.unpauseTaskSession(task.getId()));
    }
    @Test
    void endNotRunningTask() {
        Task task = createTask();
        assertThrows(IllegalStateException.class, () -> taskService.endTaskSession(task.getId()));
    }
    @Test
    void pauseNotRunningTask() {
        Task task = createTask();
        assertThrows(IllegalStateException.class, () -> taskService.pauseTaskSession(task.getId()));
    }
    @Test
    void setDaySummary() {
        dayService.setDaySummary("2024-02-15", "It was a shit day.");
    }
    @Test
    void setTodayRating() {
        dayService.setTodayRating(5);
    }
    private Task createTask() {
        NewTaskRequest taskRequest = new NewTaskRequest();
        taskRequest.setTaskName("Do chores");
        taskRequest.setTaskDescription("Vacuum nasty room");
        return taskService.createNewTask(taskRequest);
    }

}
