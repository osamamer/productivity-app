package org.osama.scheduling;

import lombok.Getter;
import org.osama.task.Task;
import org.osama.task.TaskService;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Consumer;

import static javax.management.timer.Timer.ONE_SECOND;

@Service
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
        List<ScheduledJob> jobs = scheduledJobRepository.findAllByDueDateBetween(LocalDateTime.now().minusSeconds(5),
                                LocalDateTime.now().plusSeconds(5));
        jobs.forEach(this::doJob);
    }

    private void doJob(ScheduledJob scheduledJob) {
        Consumer<String> function = jobMap.get(scheduledJob.getJobType());
        function.accept(scheduledJob.getAssociatedTaskId());
        scheduledJobRepository.delete(scheduledJob);
    }




    private Map<JobType, Consumer<String>> createJobMap() {
        Map<JobType, Consumer<String>> jobMap = new HashMap<>();

        jobMap.put(JobType.START_TASK, taskService::startTaskSession);
        jobMap.put(JobType.END_TASK, taskService::endTaskSession);
        jobMap.put(JobType.PAUSE_TASK, taskService::pauseTaskSession);
        jobMap.put(JobType.UNPAUSE_TASK, taskService::unpauseTaskSession);

        return Map.copyOf(jobMap);
    }

}
