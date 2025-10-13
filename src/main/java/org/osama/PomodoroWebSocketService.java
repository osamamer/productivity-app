package org.osama;

import lombok.extern.slf4j.Slf4j;
import org.osama.scheduling.PomodoroStatus;
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
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledFuture;

@Slf4j
@Service
public class PomodoroWebSocketService {
    private final SchedulerConfig schedulerConfig;
    private final TaskRepository taskRepository;
    private final SessionRepository sessionRepository;
    private final ScheduledJobRepository scheduledJobRepository;
    private final SimpMessagingTemplate simpMessagingTemplate;

    public PomodoroWebSocketService(TaskRepository taskRepository,
                                    SessionRepository sessionRepository, SchedulerConfig schedulerConfig,
                                    ScheduledJobRepository scheduledJobRepository, SimpMessagingTemplate simpMessagingTemplate) {
        this.taskRepository = taskRepository;
        this.sessionRepository = sessionRepository;
        this.schedulerConfig = schedulerConfig;
        this.scheduledJobRepository = scheduledJobRepository;
        this.simpMessagingTemplate = simpMessagingTemplate;
    }

    private final Map<String, ScheduledFuture<?>> statusUpdateTasks = new ConcurrentHashMap<>();
    private PomodoroStatus pomodoroStatus;

    private String activeTaskId;
    private int activeNumFocuses;

    public void startPomodoroUpdates(String taskId, int numFocuses) {
        this.activeTaskId = taskId;
        this.activeNumFocuses = numFocuses;

        Task task = taskRepository.findTaskByTaskId(taskId);

        ScheduledFuture<?> future = schedulerConfig.taskScheduler().scheduleAtFixedRate(() -> {
            Optional<Session> activeSession = sessionRepository.findSessionByTaskIdAndActiveIsTrue(taskId);

            List<ScheduledJob> futureJobs = scheduledJobRepository.findAllByScheduledIsTrueAndAssociatedTaskId(taskId);
            Optional<ScheduledJob> nextJob = futureJobs.stream()
                    .min(Comparator.comparing(ScheduledJob::getDueDate));

            if (nextJob.isPresent()) {
                boolean isRunning = activeSession.map(Session::isRunning).orElse(false);
                long secondsPassed = 0;
                if (activeSession.isPresent()) {
                    Session session = activeSession.get();
                    secondsPassed = session.getTotalSessionTime().toSeconds();
                    if (session.isRunning()) {
                        secondsPassed += Duration.between(session.getLastUnpauseTime(), LocalDateTime.now()).toSeconds();
                    }
                }
                pomodoroStatus = new PomodoroStatus(
                        taskId,
                        task.getName(),
                        activeSession.isPresent(),
                        isRunning,
                        nextJob.get().getDueDate(),
                        calculateCurrentFocusNumber(taskId, numFocuses),
                        numFocuses,
                        secondsPassed,
                        ChronoUnit.SECONDS.between(LocalDateTime.now(), nextJob.get().getDueDate())
                );
                simpMessagingTemplate.convertAndSend("/topic/pomodoro/" + taskId, pomodoroStatus);
            } else {
                pausePomodoroUpdates(taskId);
            }
        }, 1000);

        statusUpdateTasks.put(taskId, future);
    }

    public void restartPomodoroUpdates(String taskId) {
        if (this.activeTaskId != null && this.activeTaskId.equals(taskId)) {
            startPomodoroUpdates(taskId, activeNumFocuses);
        } else {
            log.error("Tried to restart pomodoro updates but no active numFocuses stored!");
        }
    }
    public void pausePomodoroUpdates(String taskId) {
        ScheduledFuture<?> future = statusUpdateTasks.get(taskId);
        if (future != null) {
            future.cancel(false);
            statusUpdateTasks.remove(taskId);
        }
    }
    public void endPomodoroUpdates(String taskId) {
        sendEndUpdate(taskId);
        pomodoroStatus = null;
        ScheduledFuture<?> future = statusUpdateTasks.get(taskId);
        if (future != null) {
            future.cancel(false);
            statusUpdateTasks.remove(taskId);
        }
        activeTaskId = null;
        activeNumFocuses = 0;
    }

    public void sendPauseUpdate(String taskId, boolean pause) {
        pomodoroStatus.setSessionRunning(!pause);
        simpMessagingTemplate.convertAndSend("/topic/pomodoro/" + taskId, pomodoroStatus);
    }
    public void sendEndUpdate(String taskId) {
        pomodoroStatus.setSessionActive(false);
        pomodoroStatus.setSessionRunning(false);
        simpMessagingTemplate.convertAndSend("/topic/pomodoro/" + taskId, pomodoroStatus);

    }


    private int calculateCurrentFocusNumber(String taskId, int totalFocuses) {
        int completedSessions = sessionRepository.countAllByTaskIdAndActiveIsFalse(taskId);
        return Math.min((completedSessions / 2) + 1, totalFocuses);
    }
}
