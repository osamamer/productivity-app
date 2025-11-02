package org.osama;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.osama.day.DayService;
import org.osama.requests.NewTaskRequest;
import org.osama.session.SessionService;
import org.osama.task.Task;
import org.osama.task.TaskRepository;
import org.osama.task.TaskService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import static org.junit.jupiter.api.Assertions.*;


@SpringBootTest
@ActiveProfiles("test")
@Transactional
public class EndToEndTest {
    @Autowired
    private TaskService taskService;
    @Autowired
    private SessionService sessionService;
    @Autowired
    private TaskRepository taskRepository;
    @Autowired
    private DayService dayService;

    private Task testTask;

    @BeforeEach
    void setUp() {
        testTask = createTask();
    }

    @AfterEach
    void tearDown() {
        try {
            if (testTask != null) {
                sessionService.endTaskSession(testTask.getTaskId());
            }
        } catch (Exception e) {
        }
    }

    @Test
    void createNewTask() {
        assertDoesNotThrow(() -> taskRepository.findTaskByTaskId(testTask.getTaskId()));
    }

    @Test
    void startAndEndSession() {
        assertDoesNotThrow(() -> sessionService.startTaskSession(testTask.getTaskId(), false));
        assertDoesNotThrow(() -> sessionService.endTaskSession(testTask.getTaskId()));
    }

    @Test
    void pauseAndUnpauseSession() {
        sessionService.startTaskSession(testTask.getTaskId(), false);
        assertDoesNotThrow(() -> sessionService.pauseTaskSession(testTask.getTaskId()));
        assertDoesNotThrow(() -> sessionService.unpauseTaskSession(testTask.getTaskId()));
    }

    @Test
    void startAlreadyRunningSession() {
        sessionService.startTaskSession(testTask.getTaskId(), false);
        assertThrows(IllegalStateException.class, () -> sessionService.startTaskSession(testTask.getTaskId(), false));
    }

    @Test
    void unpauseAlreadyRunningSession() {
        sessionService.startTaskSession(testTask.getTaskId(), false);
        assertThrows(IllegalStateException.class, () -> sessionService.unpauseTaskSession(testTask.getTaskId()));
    }

    @Test
    void endNotRunningTask() {
        assertThrows(IllegalStateException.class, () -> sessionService.endTaskSession(testTask.getTaskId()));
    }

    @Test
    void pauseNotRunningTask() {
        assertThrows(IllegalStateException.class, () -> sessionService.pauseTaskSession(testTask.getTaskId()));
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
        taskRequest.setTaskPerformTime("2025-01-13T17:09:42.411");
        return taskService.createNewTask(taskRequest);
    }
}