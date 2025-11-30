package org.osama;

import org.junit.jupiter.api.Test;
import org.osama.session.SessionRepository;
import org.osama.requests.NewTaskRequest;
import org.osama.session.SessionService;
import org.osama.task.Task;
import org.osama.task.TaskRepository;
import org.osama.task.TaskService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;

@SpringBootTest
public class TaskSessionTest {
    @Autowired
    private TaskService taskService;
    @Autowired
    private SessionService sessionService;
    @Autowired
    private TaskRepository taskRepository;
    @Autowired
    private SessionRepository sessionRepository;

    @Test
    void startTaskSession() {
        Task task = createTask();
        sessionService.startSession(task.getTaskId(), false);
    }
    public Task createTask() {
        NewTaskRequest taskRequest = new NewTaskRequest();
        taskRequest.setName("Do chores");
        taskRequest.setDescription("Vacuum nasty room");
        taskRequest.setScheduledPerformDateTime("2017-01-13T17:09:42.411");
        return taskService.createTask(taskRequest);
    }
}
