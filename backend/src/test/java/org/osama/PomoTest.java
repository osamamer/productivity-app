package org.osama;

import jakarta.transaction.Transactional;
import org.junit.jupiter.api.Test;
import org.osama.pomodoro.PomodoroService;
import org.osama.scheduling.ScheduledJob;
import org.osama.scheduling.ScheduledJobRepository;
import org.osama.scheduling.TimedExecutorService;
import org.osama.requests.NewTaskRequest;
import org.osama.session.SessionService;
import org.osama.task.Task;
import org.osama.task.TaskService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@Transactional
public class PomoTest {


    @Autowired
    private TimedExecutorService timedExecutorService;
    @Autowired
    private ScheduledJobRepository scheduledJobRepository;
    @Autowired
    private TaskService taskService;
    @Autowired
    private SessionService sessionService;
    @Autowired
    private PomodoroService pomodoroService;


    @Test
    void pomoSchedulingLogicWorks() throws InterruptedException {
        Task task = createTask();
        int focusDuration = 5;
        int shortBreakDuration = 1;
        int longBreakDuration = 2;
        int numFocuses = 3;
        int longBreakCooldown = 2;
        pomodoroService.startPomodoro(task.getTaskId(), focusDuration, shortBreakDuration, longBreakDuration, numFocuses, longBreakCooldown);
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
        pomodoroService.startPomodoro(task.getTaskId(), focusDuration, shortBreakDuration, longBreakDuration, numFocuses, longBreakCooldown);
        List<LocalDateTime> oldDueDates = scheduledJobRepository.findAllByAssociatedTaskId(task.getTaskId()).stream().map(ScheduledJob::getDueDate).toList();;
        Thread.sleep(1000);
        sessionService.pauseSession(task.getTaskId());
        Thread.sleep(pauseTime);
        sessionService.unpauseSession(task.getTaskId());
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
        taskRequest.setName("Do chores");
        taskRequest.setDescription("Vacuum nasty room");
        taskRequest.setScheduledPerformDateTime("2017-01-13T17:09:42.411");

        return taskService.createTask(taskRequest);
    }
}