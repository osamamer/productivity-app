package org.osama.scheduling;

import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
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
    private final TaskService taskService;
    @Getter
    private final Map<JobType, Consumer<String>> jobMap;


    public TimedExecutorService(ScheduledJobRepository scheduledJobRepository, TaskService taskService) {
        this.scheduledJobRepository = scheduledJobRepository;
        this.taskService = taskService;
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
        scheduledJobRepository.delete(scheduledJob);
    }




    private Map<JobType, Consumer<String>> createJobMap() {
        Map<JobType, Consumer<String>> jobMap = new HashMap<>();

        jobMap.put(JobType.START_SESSION, (taskId) -> taskService.startTaskSession(taskId, true));
        jobMap.put(JobType.END_SESSION, taskService::endTaskSession);
        jobMap.put(JobType.PAUSE_SESSION, taskService::pauseTaskSession);
        jobMap.put(JobType.UNPAUSE_SESSION, taskService::unpauseTaskSession);

        return Map.copyOf(jobMap);
    }

}
