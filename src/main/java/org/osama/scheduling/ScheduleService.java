package org.osama.scheduling;

import lombok.extern.slf4j.Slf4j;
import org.osama.pomodoro.Pomodoro;
import org.osama.pomodoro.PomodoroRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
public class ScheduleService {
    private final ScheduledJobRepository scheduledJobRepository;
    private final PomodoroRepository pomodoroRepository;

    public ScheduleService(ScheduledJobRepository scheduledJobRepository, PomodoroRepository pomodoroRepository) {
        this.scheduledJobRepository = scheduledJobRepository;
        this.pomodoroRepository = pomodoroRepository;
    }

    public void schedulePomoJobs(String taskId) {
        Pomodoro pomodoro = pomodoroRepository.findPomodoroByAssociatedTaskId(taskId);
        int n = 2* pomodoro.getNumFocuses() -1;
        int timeElapsed = 0;
        int breaksTaken = 0;
        for (int i = 0; i < n; i++) {
            if (i % 2 == 0) { // Meaning that are in an even iteration in which the task is active
                if (i == n - 1) {
                    createScheduledJob(JobType.END_POMODORO,
                            LocalDateTime.now().plusMinutes(timeElapsed + pomodoro.getFocusDuration()), pomodoro.getAssociatedTaskId());
                    break;
                }
                createScheduledJob(JobType.END_SESSION,
                        LocalDateTime.now().plusMinutes(timeElapsed + pomodoro.getFocusDuration()), pomodoro.getAssociatedTaskId());
                timeElapsed += pomodoro.getFocusDuration();
            }
            else { // Meaning that we are in an odd iteration in which we are taking a break
                breaksTaken++;
                if (breaksTaken % pomodoro.getLongBreakCooldown() != 0) { // Short break
                    createScheduledJob(JobType.START_SESSION,
                            LocalDateTime.now().plusMinutes(timeElapsed + pomodoro.getShortBreakDuration()), pomodoro.getAssociatedTaskId());
                    timeElapsed += pomodoro.getShortBreakDuration();
                }
                else { // Long break
                    createScheduledJob(JobType.START_SESSION,
                            LocalDateTime.now().plusMinutes(timeElapsed + pomodoro.getLongBreakDuration()), pomodoro.getAssociatedTaskId());
                    timeElapsed += pomodoro.getLongBreakDuration();
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
        // TODO: find out why calling this method fixed the bug wherein ending a task didn't stop the timer counting
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
