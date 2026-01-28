package org.osama;

import org.junit.jupiter.api.Test;
import org.osama.day.DayService;
import org.osama.session.task.TaskSessionRepository;
import org.osama.requests.NewTaskRequest;
import org.osama.session.task.TaskSessionService;
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
    private TaskSessionRepository taskSessionRepository;
    @Autowired
    private DayService dayService;
    @Autowired
    private TaskSessionService taskSessionService;
    @Test
    void main() throws InterruptedException {
        NewTaskRequest request = new NewTaskRequest();
        request.setName("Task one");
        request.setDescription("Task one description");
        request.setScheduledPerformDateTime("2017-01-13T17:09:42.411");
        Task task = taskService.createTask(request);
        String taskId = task.getTaskId();
        taskSessionService.startSession(taskId, false);
        Thread.sleep(25);
        taskSessionService.pauseSession(taskId);
        Thread.sleep(25);
        taskSessionService.unpauseSession(taskId);
        Thread.sleep(25);
        taskSessionService.pauseSession(taskId);
        Thread.sleep(25);
        taskSessionService.unpauseSession(taskId);
        Thread.sleep(25);
        taskSessionService.endSession(taskId);
        System.out.println(taskService.getAccumulatedTime(taskId).toMillis() + " milliseconds");
    }
    @Test
    void test() throws InterruptedException {
        NewTaskRequest request = new NewTaskRequest();
        request.setName("Task one");
        request.setDescription("Task one description");
        request.setScheduledPerformDateTime("2017-01-13T17:09:42.411");

        Task task = taskService.createTask(request);
        String taskId = task.getTaskId();
        taskSessionService.startSession(taskId, false);
        Thread.sleep(50);
        taskSessionService.pauseSession(taskId);
        Thread.sleep(25);
        taskSessionService.endSession(taskId);
        System.out.println(taskService.getAccumulatedTime(taskId).toMillis() + " milliseconds");
    }
    public void pauseSession(String taskId){
        taskSessionService.pauseSession(taskId);
    }
}
