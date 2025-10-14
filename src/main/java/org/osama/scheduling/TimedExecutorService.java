package org.osama.scheduling;

import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.osama.session.SessionService;
import org.osama.task.TaskService;
import org.springframework.scheduling.annotation.Scheduled;
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

    private static final int FIVE_SECONDS = 5000;
    private final ScheduledJobRepository scheduledJobRepository;
    @Getter
    private final Map<JobType, Consumer<String>> jobMap;
    private final SessionService sessionService;


    public TimedExecutorService(ScheduledJobRepository scheduledJobRepository, TaskService taskService, SessionService sessionService) {
        this.scheduledJobRepository = scheduledJobRepository;
        this.sessionService = sessionService;
        this.jobMap = createJobMap();

    }

    @Scheduled(fixedRate = ONE_SECOND)
    public void run() {
//        log.info("Checking for tasks between {} and {} to run", LocalDateTime.now().minusSeconds(5), LocalDateTime.now().plusSeconds(5));
        List<ScheduledJob> jobs = scheduledJobRepository.findAllByScheduledIsTrueAndDueDateBetween(LocalDateTime.now().minusSeconds(1),
                                LocalDateTime.now().plusSeconds(1));
        jobs.forEach(this::doJob);
    }

    private void doJob(ScheduledJob scheduledJob) {
        log.info("Performing {} job with ID [{}]", scheduledJob.getJobType(), scheduledJob.getJobId());
        Consumer<String> function = jobMap.get(scheduledJob.getJobType());
        function.accept(scheduledJob.getAssociatedTaskId());
        scheduledJob.setScheduled(false);
        scheduledJobRepository.save(scheduledJob);
    }

    private Map<JobType, Consumer<String>> createJobMap() {
        Map<JobType, Consumer<String>> jobMap = new HashMap<>();

        jobMap.put(JobType.START_SESSION, (taskId) -> sessionService.startTaskSession(taskId, true));
        jobMap.put(JobType.END_SESSION, sessionService::endTaskSession);
        jobMap.put(JobType.PAUSE_SESSION, sessionService::pauseTaskSession);
        jobMap.put(JobType.UNPAUSE_SESSION, sessionService::unpauseTaskSession);
        jobMap.put(JobType.END_POMODORO, sessionService::endPomodoro);


        return Map.copyOf(jobMap);
    }

}
