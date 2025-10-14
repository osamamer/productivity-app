package org.osama.pomodoro;

import lombok.extern.slf4j.Slf4j;
import org.osama.scheduling.ScheduledJob;
import org.osama.scheduling.ScheduledJobRepository;
import org.osama.scheduling.SchedulerConfig;
import org.osama.session.Session;
import org.osama.session.SessionRepository;
import org.osama.task.Task;
import org.osama.task.TaskRepository;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledFuture;

@Slf4j
@Service
public class PomodoroService {
    private final SchedulerConfig schedulerConfig;
    private final TaskRepository taskRepository;
    private final SessionRepository sessionRepository;
    private final ScheduledJobRepository scheduledJobRepository;
    private final SimpMessagingTemplate simpMessagingTemplate;
    private final PomodoroRepository pomodoroRepository;

    public PomodoroService(TaskRepository taskRepository,
                           SessionRepository sessionRepository, SchedulerConfig schedulerConfig,
                           ScheduledJobRepository scheduledJobRepository,
                           SimpMessagingTemplate simpMessagingTemplate, PomodoroRepository pomodoroRepository) {
        this.taskRepository = taskRepository;
        this.sessionRepository = sessionRepository;
        this.schedulerConfig = schedulerConfig;
        this.scheduledJobRepository = scheduledJobRepository;
        this.simpMessagingTemplate = simpMessagingTemplate;
        this.pomodoroRepository = pomodoroRepository;
    }

    private final Map<String, ScheduledFuture<?>> statusUpdateTasks = new ConcurrentHashMap<>();


    public void startPomodoroUpdates(String taskId) {
        Pomodoro pomodoro = pomodoroRepository.findPomodoroByAssociatedTaskId(taskId);
        Task task = taskRepository.findTaskByTaskId(taskId);

        ScheduledFuture<?> future = schedulerConfig.taskScheduler().scheduleAtFixedRate(() -> {

            Optional<Session> activeSession = sessionRepository.findSessionByAssociatedTaskIdAndActiveIsTrue(taskId);
            List<ScheduledJob> futureJobs = scheduledJobRepository.findAllByScheduledIsTrueAndAssociatedTaskId(taskId);
            List<ScheduledJob> pastJobs = scheduledJobRepository.findAllByScheduledIsFalseAndAssociatedTaskId(taskId);
            Optional<ScheduledJob> previousJob = pastJobs.stream()
                    .max(Comparator.comparing(ScheduledJob::getDueDate));
            Optional<ScheduledJob> nextJob = futureJobs.stream()
                    .min(Comparator.comparing(ScheduledJob::getDueDate));
            if (nextJob.isPresent() && pomodoro.isActive()) {
                    if (activeSession.isPresent()) { // If a session is running
                        Session session = activeSession.get();
                        pomodoro.setSecondsPassedInSession(session.getTotalSessionTime().toSeconds());
                        if (session.isRunning()) {
                            pomodoro.setSecondsPassedInSession(pomodoro.getSecondsPassedInSession()
                                    + Duration.between(session.getLastUnpauseTime(), LocalDateTime.now()).toSeconds());
                        }
                    }
                    else if (previousJob.isPresent()) { // If the pomodoro is in the break
                        pomodoro.setSecondsPassedInSession(Duration.between(previousJob.get().getDueDate(), LocalDateTime.now()).toSeconds());
                    }
                    pomodoro.setSecondsUntilNextTransition(ChronoUnit.SECONDS.between(LocalDateTime.now(), nextJob.get().getDueDate()));
                    pomodoroRepository.save(pomodoro);
                simpMessagingTemplate.convertAndSend("/topic/pomodoro/" + taskId, pomodoro);
            } else {
                pausePomodoroUpdates(taskId);
            }
        }, 1000);
        statusUpdateTasks.put(taskId, future);
    }


    public void pausePomodoroUpdates(String taskId) {
        ScheduledFuture<?> future = statusUpdateTasks.get(taskId);
        if (future != null) {
            future.cancel(false);
            statusUpdateTasks.remove(taskId);
        }
    }

    public void sendAsyncUpdate(String taskId) {
        log.info("Sending asynchronous update.");
        Pomodoro pomodoro = pomodoroRepository.findPomodoroByAssociatedTaskId(taskId);
        simpMessagingTemplate.convertAndSend("/topic/pomodoro/" + taskId, pomodoro);
    }


     public Pomodoro createPomodoro(String associatedTaskId, int focusDuration, int shortBreakDuration,
                                    int longBreakDuration, int numFocuses, int longBreakCooldown) {
        Pomodoro pomodoro = new Pomodoro();

        pomodoro.setPomodoroId(UUID.randomUUID().toString());
        pomodoro.setAssociatedTaskId(associatedTaskId);
        pomodoro.setActive(true);
        pomodoro.setFocusDuration(focusDuration);
        pomodoro.setShortBreakDuration(shortBreakDuration);
        pomodoro.setLongBreakDuration(longBreakDuration);
        pomodoro.setNumFocuses(numFocuses);
        pomodoro.setLongBreakCooldown(longBreakCooldown);
        pomodoro.setSessionActive(true);
        pomodoro.setSessionRunning(true);
        pomodoro.setCurrentFocusNumber(0);
        pomodoro.setSecondsPassedInSession(0);

        pomodoroRepository.save(pomodoro);
        return pomodoro;
    }
}
