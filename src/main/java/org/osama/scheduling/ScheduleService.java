package org.osama.scheduling;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
public class ScheduleService {
    private final ScheduledJobRepository scheduledJobRepository;

    public ScheduleService(ScheduledJobRepository scheduledJobRepository) {
        this.scheduledJobRepository = scheduledJobRepository;
    }

    public void schedulePomoJobs(String taskId, int focusDuration,
                                 int shortBreakDuration, int longBreakDuration,
                                 int numFocuses, int longBreakCooldown) {
        // Why are we even using the same session? What is actually the point? Why not different sessions?
        int n = 2*numFocuses-1;
        int timeElapsed = 0;
        int breaksTaken = 0;
        for (int i = 0; i < n; i++) {
            if (i % 2 == 0) { // Meaning that are in an even iteration in which the task is active
                createScheduledJob(JobType.END_SESSION,
                        LocalDateTime.now().plusMinutes(timeElapsed + focusDuration), taskId);
                timeElapsed += focusDuration;
            }
            else { // Meaning that we are in an odd iteration in which we are taking a break
                breaksTaken++;
                if (breaksTaken % longBreakCooldown != 0) { // Short break
                    createScheduledJob(JobType.START_SESSION,
                            LocalDateTime.now().plusMinutes(timeElapsed + shortBreakDuration), taskId);
                    timeElapsed += shortBreakDuration;
                }
                else { // Long break
                    createScheduledJob(JobType.START_SESSION,
                            LocalDateTime.now().plusMinutes(timeElapsed + longBreakDuration), taskId);
                    timeElapsed += longBreakDuration;
                }
            }
        }
    }
    public void unscheduleTaskJobs(String taskId) { // For when the user pauses
        List<ScheduledJob> taskJobs = scheduledJobRepository.findAllByAssociatedTaskId(taskId);
        taskJobs.forEach((job) -> {
            job.setScheduled(false);
            scheduledJobRepository.save(job);
        });
        log.info("Unscheduled jobs for task with ID [{}]", taskId);

    }
    public void rescheduleTaskJobs(String taskId) { // For when the user unpauses
        List<ScheduledJob> taskJobs = scheduledJobRepository.findAllByAssociatedTaskId(taskId);
        taskJobs.forEach((job) -> {
            job.setScheduled(true);
            scheduledJobRepository.save(job);
        });
        log.info("Rescheduled jobs for task with ID [{}]", taskId);

    }
    public void shiftTaskJobDueDates(String taskId, int shift) {
        List<ScheduledJob> taskJobs = scheduledJobRepository.findAllByAssociatedTaskId(taskId);
        taskJobs.forEach((job) -> {
            job.setDueDate(job.getDueDate().plusSeconds(shift));
            scheduledJobRepository.save(job);
            log.info("Shifted {} job to {}", job.getJobType(), job.getDueDate());
        });
    }
    private ScheduledJob createScheduledJob(JobType jobType, LocalDateTime dueDate, String taskId) {
        ScheduledJob scheduledJob = new ScheduledJob();
        scheduledJob.setJobId(UUID.randomUUID().toString());
        scheduledJob.setJobType(jobType);
        scheduledJob.setDueDate(dueDate);
        scheduledJob.setAssociatedTaskId(taskId);
        scheduledJob.setScheduled(true);
        scheduledJobRepository.save(scheduledJob);
        log.info("Scheduled {} job for task [{}] on {}", jobType.toString(), taskId, dueDate);
        return scheduledJob;
    }
}
