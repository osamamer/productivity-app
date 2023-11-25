package org.osama;

import org.junit.jupiter.api.Test;
import org.osama.day.DayService;
import org.osama.session.SessionRepository;
import org.osama.task.NewTaskRequest;
import org.osama.task.Task;
import org.osama.task.TaskRepository;
import org.osama.task.TaskService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
public class ConsoleTest {
    @Autowired
    private TaskService taskService;
    @Autowired
    private TaskRepository taskRepository;
    @Autowired
    private SessionRepository sessionRepository;
    @Autowired
    private DayService dayService;
    @Test
    void main() throws InterruptedException {
        NewTaskRequest request = new NewTaskRequest();
        request.setTaskName("Task poop");
        request.setTaskDescription("Task poop description");
        Task task = taskService.createNewTask(request);
        String taskId = task.getTaskId();
        taskService.startTaskSession(taskId);
        Thread.sleep(500);
        taskService.pauseTaskSession(taskId);
        Thread.sleep(250);
        taskService.unpauseTaskSession(taskId);
        Thread.sleep(5000);
        taskService.pauseTaskSession(taskId);
        Thread.sleep(250);
        taskService.unpauseTaskSession(taskId);
        Thread.sleep(5000);
        taskService.endTaskSession(taskId);
        System.out.println(taskService.getAccumulatedTime(taskId) + " seconds");
    }
    public void pauseSession(String taskId){
        taskService.pauseTaskSession(taskId);
    }
}
