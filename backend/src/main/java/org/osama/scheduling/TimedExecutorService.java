package org.osama.scheduling;

import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.osama.pomodoro.PomodoroService;
import org.osama.pomodoro.PomodoroTransition;
import org.osama.pomodoro.PomodoroTransitionNotification;
import org.osama.session.task.TaskSessionService;
import org.osama.task.Task;
import org.osama.task.TaskRepository;
import org.osama.user.User;
import org.osama.user.UserRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

import static javax.management.timer.Timer.ONE_SECOND;

@Service
@Slf4j
public class TimedExecutorService {

    private final ScheduledJobRepository scheduledJobRepository;
    private final PomodoroService pomodoroService;
    private final TaskSessionService taskSessionService;
    private final TaskRepository taskRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @Getter
    private final Map<JobType, Consumer<String>> jobMap;


    public TimedExecutorService(ScheduledJobRepository scheduledJobRepository,
                                TaskSessionService taskSessionService,
                                PomodoroService pomodoroService,
                                TaskRepository taskRepository,
                                UserRepository userRepository,
                                SimpMessagingTemplate messagingTemplate) {
        this.scheduledJobRepository = scheduledJobRepository;
        this.taskSessionService = taskSessionService;
        this.pomodoroService = pomodoroService;
        this.taskRepository = taskRepository;
        this.userRepository = userRepository;
        this.messagingTemplate = messagingTemplate;
        this.jobMap = createJobMap();
    }

    @Scheduled(fixedRate = ONE_SECOND)
    public void run() {
        List<ScheduledJob> jobs = scheduledJobRepository
                .findAllByScheduledIsTrueAndDueDateLessThanEqualOrderByDueDateAsc(LocalDateTime.now());
        jobs.forEach(this::doJob);
    }

    private void doJob(ScheduledJob scheduledJob) {
        log.info("Performing {} job with ID [{}]", scheduledJob.getJobType(), scheduledJob.getJobId());
        Consumer<String> function = jobMap.get(scheduledJob.getJobType());
        if (function == null) {
            log.error("Scheduled job has no handler: jobId={} jobType={} taskId={}",
                    scheduledJob.getJobId(), scheduledJob.getJobType(), scheduledJob.getAssociatedTaskId());
            return;
        }

        try {
            // Claim the job before invoking its handler so transition listeners only see the next deadline.
            scheduledJob.setScheduled(false);
            scheduledJobRepository.save(scheduledJob);
            function.accept(scheduledJob.getAssociatedTaskId());
            try {
                sendAutomaticTransitionNotification(scheduledJob);
            } catch (Exception e) {
                log.error("Scheduled job completed but Pomodoro notification failed: jobId={} jobType={} taskId={}",
                        scheduledJob.getJobId(), scheduledJob.getJobType(), scheduledJob.getAssociatedTaskId(), e);
            }
            log.info("Scheduled job completed: jobId={} jobType={} taskId={}",
                    scheduledJob.getJobId(), scheduledJob.getJobType(), scheduledJob.getAssociatedTaskId());
        } catch (Exception e) {
            scheduledJob.setScheduled(true);
            scheduledJobRepository.save(scheduledJob);
            log.error("Scheduled job failed: jobId={} jobType={} taskId={}",
                    scheduledJob.getJobId(), scheduledJob.getJobType(), scheduledJob.getAssociatedTaskId(), e);
        }
    }

    private void sendAutomaticTransitionNotification(ScheduledJob scheduledJob) {
        PomodoroTransition transition = switch (scheduledJob.getJobType()) {
            case END_SESSION -> PomodoroTransition.FOCUS_ENDED;
            case START_SESSION -> PomodoroTransition.BREAK_ENDED;
            case END_POMODORO -> PomodoroTransition.POMODORO_ENDED;
            default -> null;
        };

        if (transition == null) return;

        User user = userRepository.findUserById(scheduledJob.getUserId()).orElse(null);
        if (user == null) {
            log.warn("Cannot send Pomodoro transition notification without app user: jobId={} taskId={} userId={}",
                    scheduledJob.getJobId(), scheduledJob.getAssociatedTaskId(), scheduledJob.getUserId());
            return;
        }

        String keycloakId = user.getKeycloakId();
        if (keycloakId == null || keycloakId.isBlank()) {
            log.warn("Cannot send Pomodoro transition notification without Keycloak user: jobId={} taskId={}",
                    scheduledJob.getJobId(), scheduledJob.getAssociatedTaskId());
            return;
        }

        String taskName = taskRepository.findTaskByTaskId(scheduledJob.getAssociatedTaskId())
                .map(Task::getName)
                .orElse("Pomodoro task");
        PomodoroTransitionNotification notification = new PomodoroTransitionNotification(
                scheduledJob.getJobId(),
                scheduledJob.getAssociatedTaskId(),
                taskName,
                transition
        );
        messagingTemplate.convertAndSendToUser(keycloakId, "/queue/pomodoro", notification);
        log.info("Pomodoro transition notification sent: userId={} jobId={} taskId={} transition={}",
                scheduledJob.getUserId(), scheduledJob.getJobId(), scheduledJob.getAssociatedTaskId(), transition);
    }

    private Map<JobType, Consumer<String>> createJobMap() {
        Map<JobType, Consumer<String>> jobMap = new HashMap<>();

        jobMap.put(JobType.START_SESSION, pomodoroService::advanceFromBreak);
        jobMap.put(JobType.END_SESSION, taskSessionService::endSession);
        jobMap.put(JobType.PAUSE_SESSION, taskSessionService::pauseSession);
        jobMap.put(JobType.UNPAUSE_SESSION, taskSessionService::unpauseSession);
        jobMap.put(JobType.END_POMODORO, pomodoroService::endPomodoro);


        return Map.copyOf(jobMap);
    }

}
