package org.osama.scheduling;

import lombok.extern.slf4j.Slf4j;
import org.osama.pomodoro.Pomodoro;
import org.osama.pomodoro.PomodoroRepository;
import org.osama.pomodoro.PomodoroSettings;
import org.osama.user.User;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
public class ScheduleService {
    private final ScheduledJobRepository scheduledJobRepository;
    private final PomodoroRepository pomodoroRepository;
    private final PomodoroSettings pomodoroSettings;

    public ScheduleService(ScheduledJobRepository scheduledJobRepository,
                           PomodoroRepository pomodoroRepository,
                           PomodoroSettings pomodoroSettings) {
        this.scheduledJobRepository = scheduledJobRepository;
        this.pomodoroRepository = pomodoroRepository;
        this.pomodoroSettings = pomodoroSettings;
    }

    public void schedulePomoJobs(String taskId) {
        schedulePomoJobs(taskId, pomodoroSettings.isDevSecondsMode());
    }

    public void schedulePomoJobs(String taskId, boolean secondsMode) {
        Pomodoro pomodoro = pomodoroRepository.findPomodoroByAssociatedTaskIdAndIsActiveIsTrue(taskId).orElseThrow(
                () -> new IllegalStateException("No active pomodoro found for task: " + taskId));
        User user = pomodoro.getUser();
        if (!pomodoro.isAutoStartSessions()) {
            scheduleFocusEnd(taskId, pomodoro, secondsMode);
            return;
        }
        int n = 2* pomodoro.getNumFocuses() -1;
        long timeElapsedSeconds = 0;
        int breaksTaken = 0;
        log.info("Scheduling pomodoro jobs: userId={} taskId={} focusCount={}",
                user.getId(), taskId, pomodoro.getNumFocuses());
        for (int i = 0; i < n; i++) {
            if (i % 2 == 0) { // Meaning that are in an even iteration in which the task is active
                if (i == n - 1) {
                    createScheduledJob(JobType.END_POMODORO,
                            LocalDateTime.now().plusSeconds(timeElapsedSeconds
                                    + pomodoroSettings.durationInSeconds(pomodoro.getFocusDuration(), secondsMode)),
                            pomodoro.getAssociatedTaskId(), user);
                    break;
                }
                createScheduledJob(JobType.END_SESSION,
                        LocalDateTime.now().plusSeconds(timeElapsedSeconds
                                + pomodoroSettings.durationInSeconds(pomodoro.getFocusDuration(), secondsMode)),
                        pomodoro.getAssociatedTaskId(), user);
                timeElapsedSeconds += pomodoroSettings.durationInSeconds(pomodoro.getFocusDuration(), secondsMode);
            }
            else { // Meaning that we are in an odd iteration in which we are taking a break
                breaksTaken++;
                if (breaksTaken % pomodoro.getLongBreakCooldown() != 0) { // Short break
                    createScheduledJob(JobType.START_SESSION,
                            LocalDateTime.now().plusSeconds(timeElapsedSeconds
                                    + pomodoroSettings.durationInSeconds(pomodoro.getShortBreakDuration(), secondsMode)),
                            pomodoro.getAssociatedTaskId(), user);
                    timeElapsedSeconds += pomodoroSettings.durationInSeconds(pomodoro.getShortBreakDuration(), secondsMode);
                }
                else { // Long break
                    createScheduledJob(JobType.START_SESSION,
                            LocalDateTime.now().plusSeconds(timeElapsedSeconds
                                    + pomodoroSettings.durationInSeconds(pomodoro.getLongBreakDuration(), secondsMode)),
                            pomodoro.getAssociatedTaskId(), user);
                    timeElapsedSeconds += pomodoroSettings.durationInSeconds(pomodoro.getLongBreakDuration(), secondsMode);
                }
            }
        }
    }

    public void scheduleFocusEnd(String taskId) {
        Pomodoro pomodoro = pomodoroRepository.findPomodoroByAssociatedTaskIdAndIsActiveIsTrue(taskId)
                .orElseThrow(() -> new IllegalStateException("No active pomodoro found for task: " + taskId));
        scheduleFocusEnd(taskId, pomodoro, pomodoro.isSecondsMode());
    }

    public void scheduleBreakEnd(String taskId) {
        Pomodoro pomodoro = pomodoroRepository.findPomodoroByAssociatedTaskIdAndIsActiveIsTrue(taskId)
                .orElseThrow(() -> new IllegalStateException("No active pomodoro found for task: " + taskId));
        long breakDuration = pomodoro.getCurrentFocusNumber() % pomodoro.getLongBreakCooldown() == 0
                ? pomodoroSettings.durationInSeconds(pomodoro.getLongBreakDuration(), pomodoro.isSecondsMode())
                : pomodoroSettings.durationInSeconds(pomodoro.getShortBreakDuration(), pomodoro.isSecondsMode());
        createScheduledJob(JobType.START_SESSION,
                LocalDateTime.now().plusSeconds(breakDuration), taskId, pomodoro.getUser());
        log.info("Scheduled manual Pomodoro break end: userId={} taskId={} durationSeconds={}",
                pomodoro.getUser().getId(), taskId, breakDuration);
    }

    private void scheduleFocusEnd(String taskId, Pomodoro pomodoro, boolean secondsMode) {
        long focusDuration = pomodoroSettings.durationInSeconds(pomodoro.getFocusDuration(), secondsMode);
        JobType jobType = pomodoro.getCurrentFocusNumber() + 1 >= pomodoro.getNumFocuses()
                ? JobType.END_POMODORO
                : JobType.END_SESSION;
        createScheduledJob(jobType,
                LocalDateTime.now().plusSeconds(focusDuration), taskId, pomodoro.getUser());
        log.info("Scheduled manual Pomodoro focus end: userId={} taskId={} durationSeconds={} jobType={}",
                pomodoro.getUser().getId(), taskId, focusDuration, jobType);
    }

    public void unscheduleTaskJobs(String taskId) {
        List<ScheduledJob> taskJobs = scheduledJobRepository.findAllByScheduledIsTrueAndAssociatedTaskId(taskId);
        taskJobs.forEach((job) -> {
            job.setScheduled(false);
            scheduledJobRepository.save(job);
        });
        log.info("Pomodoro jobs unscheduled: taskId={} count={}", taskId, taskJobs.size());
    }

    public void resumeTaskJobs(String taskId, LocalDateTime pauseStartedAt, Duration pauseDuration) {
        List<ScheduledJob> pausedJobs = scheduledJobRepository
                .findAllByScheduledIsFalseAndAssociatedTaskId(taskId)
                .stream()
                .filter(job -> !job.getDueDate().isBefore(pauseStartedAt))
                .toList();
        pausedJobs.forEach(job -> {
            job.setDueDate(job.getDueDate().plus(pauseDuration));
            job.setScheduled(true);
            scheduledJobRepository.save(job);
        });
        log.info("Pomodoro jobs resumed: taskId={} count={} pauseDuration={}",
                taskId, pausedJobs.size(), pauseDuration);
    }

    public void finishBreakEarly(String taskId) {
        Pomodoro pomodoro = pomodoroRepository.findPomodoroByAssociatedTaskIdAndIsActiveIsTrue(taskId)
                .orElseThrow(() -> new IllegalStateException("No active pomodoro found for task: " + taskId));
        List<ScheduledJob> pendingJobs = scheduledJobRepository
                .findAllByScheduledIsTrueAndAssociatedTaskId(taskId)
                .stream()
                .sorted(Comparator.comparing(ScheduledJob::getDueDate))
                .toList();
        if (pendingJobs.isEmpty() || pendingJobs.get(0).getJobType() != JobType.START_SESSION) {
            throw new IllegalStateException("Pomodoro break does not have a pending end.");
        }

        ScheduledJob breakEndJob = pendingJobs.get(0);
        Duration remainingBreak = Duration.between(LocalDateTime.now(), breakEndJob.getDueDate());
        if (remainingBreak.isNegative()) {
            remainingBreak = Duration.ZERO;
        }
        scheduledJobRepository.delete(breakEndJob);

        if (pomodoro.isAutoStartSessions()) {
            Duration scheduleShift = remainingBreak.negated();
            pendingJobs.stream().skip(1).forEach(job -> {
                job.setDueDate(job.getDueDate().plus(scheduleShift));
                scheduledJobRepository.save(job);
            });
        } else {
            scheduleFocusEnd(taskId, pomodoro, pomodoro.isSecondsMode());
        }
        log.info("Pomodoro break ended early: userId={} taskId={} remainingBreak={}",
                pomodoro.getUser().getId(), taskId, remainingBreak);
    }

    public void deleteTaskJobs(String taskId) {
        List<ScheduledJob> taskJobs = scheduledJobRepository.findAllByAssociatedTaskId(taskId);
        scheduledJobRepository.deleteAll(taskJobs);
        log.info("Pomodoro jobs deleted: taskId={} count={}", taskId, taskJobs.size());
    }

    private ScheduledJob createScheduledJob(JobType jobType, LocalDateTime dueDate, String taskId, User user) {
        ScheduledJob scheduledJob = new ScheduledJob();
        scheduledJob.setJobId(UUID.randomUUID().toString());
        scheduledJob.setJobType(jobType);
        scheduledJob.setDueDate(dueDate);
        scheduledJob.setAssociatedTaskId(taskId);
        scheduledJob.setScheduled(true);
        scheduledJob.setUser(user);
        scheduledJobRepository.save(scheduledJob);
        log.info("Scheduled {} job for task [{}] on {}", jobType.toString(), taskId, dueDate);
        return scheduledJob;
    }
}
