package org.osama;

import org.junit.jupiter.api.Test;
import org.osama.session.SessionRepository;
import org.osama.task.NewTaskRequest;
import org.osama.task.Task;
import org.osama.task.TaskRepository;
import org.osama.task.TaskService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;

@SpringBootTest
public class SessionTest {
    @Autowired
    private TaskService taskService;
    @Autowired
    private TaskRepository taskRepository;
    @Autowired
    private SessionRepository sessionRepository;

    @Test
    void startTaskSession() {
        Task task = createTask();
        taskService.startTaskSession(task.getTaskId());
    }
    private Task createTask() {
        NewTaskRequest taskRequest = new NewTaskRequest();
        taskRequest.setTaskName("Do chores");
        taskRequest.setTaskDescription("Vacuum nasty room");
        taskRequest.setTaskPerformTime("2017-01-13T17:09:42.411");

        return taskService.createNewTask(taskRequest);
    }
}
