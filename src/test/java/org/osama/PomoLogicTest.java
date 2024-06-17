package org.osama;

import org.junit.jupiter.api.Test;
import org.osama.scheduling.JobType;
import org.osama.scheduling.ScheduledJobRepository;
import org.osama.scheduling.TimedExecutorService;
import org.osama.task.NewTaskRequest;
import org.osama.task.Task;
import org.osama.task.TaskService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
public class PomoLogicTest {


    @Autowired
    private TimedExecutorService timedExecutorService;
    @Autowired
    private ScheduledJobRepository scheduledJobRepository;
    @Autowired
    private TaskService taskService;


    @Test
    void pomoSchedulingLogicWorks() {
        Task task = createTask();
        int focusDuration = 30;
        int shortBreakDuration = 10;
        int longBreakDuration = 15;
        int numFocuses = 6;
        int longBreakCooldown = 3;

        taskService.startPomodoro(task.getTaskId(), focusDuration, shortBreakDuration, longBreakDuration, numFocuses, longBreakCooldown);

    }
    public Task createTask() {
        NewTaskRequest taskRequest = new NewTaskRequest();
        taskRequest.setTaskName("Do chores");
        taskRequest.setTaskDescription("Vacuum nasty room");
        taskRequest.setTaskPerformTime("2017-01-13T17:09:42.411");

        return taskService.createNewTask(taskRequest);
    }
}