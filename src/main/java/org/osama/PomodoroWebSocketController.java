package org.osama;

import org.osama.scheduling.PomodoroStatus;
import org.osama.scheduling.ScheduledJob;
import org.osama.scheduling.ScheduledJobRepository;
import org.osama.scheduling.SchedulerConfig;
import org.osama.session.Session;
import org.osama.session.SessionRepository;
import org.osama.task.Task;
import org.osama.task.TaskRepository;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledFuture;

@Controller
public class PomodoroWebSocketController {
    private final SchedulerConfig schedulerConfig;
    private final TaskRepository taskRepository;
    private final SessionRepository sessionRepository;
    private final ScheduledJobRepository scheduledJobRepository;
    private final SimpMessagingTemplate simpMessagingTemplate;
    public PomodoroWebSocketController(TaskRepository taskRepository,
                                       SessionRepository sessionRepository, SchedulerConfig schedulerConfig,
                                       ScheduledJobRepository scheduledJobRepository, SimpMessagingTemplate simpMessagingTemplate) {
        this.taskRepository = taskRepository;
        this.sessionRepository = sessionRepository;
        this.schedulerConfig = schedulerConfig;
        this.scheduledJobRepository = scheduledJobRepository;
        this.simpMessagingTemplate = simpMessagingTemplate;
    }

    private final Map<String, ScheduledFuture<?>> statusUpdateTasks = new ConcurrentHashMap<>();

    public void startPomodoroUpdates(String taskId, int numFocuses) {
        Task task = taskRepository.findTaskByTaskId(taskId);

        ScheduledFuture<?> future = schedulerConfig.taskScheduler().scheduleAtFixedRate(() -> {
            Optional<Session> activeSession = sessionRepository.findSessionByTaskIdAndActiveIsTrue(taskId);

            // Find the next scheduled job for this task
            List<ScheduledJob> futureJobs = scheduledJobRepository.findAllByScheduledIsTrueAndAssociatedTaskId(taskId);
            Optional<ScheduledJob> nextJob = futureJobs.stream()
                    .min(Comparator.comparing(ScheduledJob::getDueDate));

            if (nextJob.isPresent()) {
                PomodoroStatus status = new PomodoroStatus(
                        taskId,
                        task.getName(),
                        activeSession.isPresent(),
                        nextJob.get().getDueDate(),
                        calculateCurrentFocusNumber(taskId, numFocuses),
                        numFocuses,
                        ChronoUnit.SECONDS.between(LocalDateTime.now(), nextJob.get().getDueDate())
                );

                simpMessagingTemplate.convertAndSend("/topic/pomodoro/" + taskId, status);
            } else {
                // No more scheduled jobs - pomodoro is complete
                stopPomodoroUpdates(taskId);
            }
        }, 1000);

        statusUpdateTasks.put(taskId, future);
    }

    public void stopPomodoroUpdates(String taskId) {
        ScheduledFuture<?> future = statusUpdateTasks.get(taskId);
        if (future != null) {
            future.cancel(false);
            statusUpdateTasks.remove(taskId);
        }
    }

    private int calculateCurrentFocusNumber(String taskId, int totalFocuses) {
        int completedSessions = sessionRepository.countAllByTaskIdAndActiveIsFalse(taskId);
        return Math.min((completedSessions / 2) + 1, totalFocuses);
    }
}
