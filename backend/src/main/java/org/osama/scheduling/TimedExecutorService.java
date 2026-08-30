package org.osama.scheduling;

import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

import static javax.management.timer.Timer.ONE_SECOND;

@Service
@Slf4j
public class TimedExecutorService {

    private final ScheduledJobRepository scheduledJobRepository;
    private final ScheduledJobExecutor scheduledJobExecutor;


    public TimedExecutorService(ScheduledJobRepository scheduledJobRepository,
                                ScheduledJobExecutor scheduledJobExecutor) {
        this.scheduledJobRepository = scheduledJobRepository;
        this.scheduledJobExecutor = scheduledJobExecutor;
    }

    @Scheduled(fixedRate = ONE_SECOND)
    public void run() {
        List<ScheduledJob> jobs = scheduledJobRepository
                .findAllByScheduledIsTrueAndDueDateLessThanEqualOrderByDueDateAsc(LocalDateTime.now());
        for (ScheduledJob job : jobs) {
            try {
                scheduledJobExecutor.execute(job.getJobId());
            } catch (Exception e) {
                log.error("Scheduled job failed and will be retried: jobId={} jobType={} taskId={}",
                        job.getJobId(), job.getJobType(), job.getAssociatedTaskId(), e);
            }
        }
    }
}
