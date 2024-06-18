package org.osama;

import org.junit.jupiter.api.Test;
import org.osama.scheduling.ScheduledJob;
import org.osama.scheduling.ScheduledJobRepository;
import org.osama.scheduling.TimedExecutorService;
import org.osama.task.requests.NewTaskRequest;
import org.osama.task.Task;
import org.osama.task.TaskService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
public class PomoTest {


    @Autowired
    private TimedExecutorService timedExecutorService;
    @Autowired
    private ScheduledJobRepository scheduledJobRepository;
    @Autowired
    private TaskService taskService;


    @Test
    void pomoSchedulingLogicWorks() throws InterruptedException {
        Task task = createTask();
        int focusDuration = 5;
        int shortBreakDuration = 1;
        int longBreakDuration = 2;
        int numFocuses = 3;
        int longBreakCooldown = 2;
        taskService.startPomodoro(task.getTaskId(), focusDuration, shortBreakDuration, longBreakDuration, numFocuses, longBreakCooldown);
    }
    @Test
    void pomoUserInterventionTest() throws InterruptedException {
        Task task = createTask();
        int focusDuration = 5;
        int shortBreakDuration = 1;
        int longBreakDuration = 2;
        int numFocuses = 3;
        int longBreakCooldown = 2;
        long pauseTime = 1000;
        taskService.startPomodoro(task.getTaskId(), focusDuration, shortBreakDuration, longBreakDuration, numFocuses, longBreakCooldown);
        List<LocalDateTime> oldDueDates = scheduledJobRepository.findAllByAssociatedTaskId(task.getTaskId()).stream().map(ScheduledJob::getDueDate).toList();;
        Thread.sleep(1000);
        taskService.pauseTaskSession(task.getTaskId());
        Thread.sleep(pauseTime);
        taskService.unpauseTaskSession(task.getTaskId());
        List<LocalDateTime> newDueDates = scheduledJobRepository.findAllByAssociatedTaskId(task.getTaskId()).stream().map(ScheduledJob::getDueDate).toList();
        for (LocalDateTime date:newDueDates) {
            System.out.println(date);
        }
        for (int i = 0; i < oldDueDates.size(); i++) {
            assertEquals(oldDueDates.get(i).plusSeconds(pauseTime/1000), newDueDates.get(i));
        }
    }
    public Task createTask() {
        NewTaskRequest taskRequest = new NewTaskRequest();
        taskRequest.setTaskName("Do chores");
        taskRequest.setTaskDescription("Vacuum nasty room");
        taskRequest.setTaskPerformTime("2017-01-13T17:09:42.411");

        return taskService.createNewTask(taskRequest);
    }
}