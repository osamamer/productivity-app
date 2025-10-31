package org.osama;

import org.junit.jupiter.api.Test;
import org.osama.day.DayService;
import org.osama.requests.NewTaskRequest;
import org.osama.session.SessionService;
import org.osama.task.Task;
import org.osama.task.TaskRepository;
import org.osama.task.TaskService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.junit.jupiter.api.Assertions.*;


@SpringBootTest
public class EndToEndTest {
    @Autowired
    private TaskService taskService;
    @Autowired
    private SessionService sessionService;
    @Autowired
    private TaskRepository taskRepository;
    @Autowired
    private DayService dayService;
    @Test
    void createNewTask() {
        Task task = createTask();
        assertDoesNotThrow(() -> taskRepository.findTaskByTaskId(task.getTaskId()));
//        assertThrows(InvalidDataAccessApiUsageException.class, () -> taskRepository.findTaskByTaskId("INVALID_ID"));
    }

    @Test
    void startAndEndSession() {
        Task task = createTask();
        assertDoesNotThrow(() -> sessionService.startTaskSession(task.getTaskId(), false));
        assertDoesNotThrow(() -> sessionService.endTaskSession(task.getTaskId()));
    }
    @Test
    void pauseAndUnpauseSession() {
        Task task = createTask();
        sessionService.startTaskSession(task.getTaskId(), false);
        assertDoesNotThrow(() -> sessionService.pauseTaskSession(task.getTaskId()));
        assertDoesNotThrow(() -> sessionService.unpauseTaskSession(task.getTaskId()));
    }
    @Test
    void startAlreadyRunningSession() {
        Task task = createTask();
        sessionService.startTaskSession(task.getTaskId(), false);
        assertThrows(IllegalStateException.class, () -> sessionService.startTaskSession(task.getTaskId(), false));
    }
    @Test
    void unpauseAlreadyRunningSession() {
        Task task = createTask();
        sessionService.startTaskSession(task.getTaskId(), false);
        assertThrows(IllegalStateException.class, () -> sessionService.unpauseTaskSession(task.getTaskId()));
    }
    @Test
    void endNotRunningTask() {
        Task task = createTask();
        assertThrows(IllegalStateException.class, () -> sessionService.endTaskSession(task.getTaskId()));
    }
    @Test
    void pauseNotRunningTask() {
        Task task = createTask();
        assertThrows(IllegalStateException.class, () -> sessionService.pauseTaskSession(task.getTaskId()));
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
