package org.osama.pomodoro;

import lombok.extern.slf4j.Slf4j;
import org.osama.scheduling.ScheduleService;
import org.osama.scheduling.ScheduledJob;
import org.osama.scheduling.ScheduledJobRepository;
import org.osama.scheduling.SchedulerConfig;
import org.osama.session.*;
import org.osama.session.events.SessionEndedEvent;
import org.osama.session.events.SessionPausedEvent;
import org.osama.session.events.SessionStartedEvent;
import org.osama.session.events.SessionUnpausedEvent;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledFuture;
import org.springframework.context.event.EventListener;

@Slf4j
@Service
public class PomodoroService {
    private final PomodoroRepository pomodoroRepository;
    private final ScheduledJobRepository scheduledJobRepository;
    private final SessionRepository sessionRepository;
    private final ScheduleService scheduleService;
    private final SchedulerConfig schedulerConfig;
    private final SimpMessagingTemplate simpMessagingTemplate;
    private final SessionService sessionService;

    private final Map<String, ScheduledFuture<?>> statusUpdateTasks = new ConcurrentHashMap<>();

    public PomodoroService(PomodoroRepository pomodoroRepository,
                           ScheduledJobRepository scheduledJobRepository,
                           SessionRepository sessionRepository,
                           ScheduleService scheduleService,
                           SchedulerConfig schedulerConfig,
                           SimpMessagingTemplate simpMessagingTemplate,
                           SessionService sessionService) {
        this.pomodoroRepository = pomodoroRepository;
        this.scheduledJobRepository = scheduledJobRepository;
        this.sessionRepository = sessionRepository;
        this.scheduleService = scheduleService;
        this.schedulerConfig = schedulerConfig;
        this.simpMessagingTemplate = simpMessagingTemplate;
        this.sessionService = sessionService;
    }

    // ============ Event Listeners ============

    @EventListener
    public void handleSessionStarted(SessionStartedEvent event) {
        if (!event.isPomodoro()) return;

        log.info("Handling session started event for pomodoro task: {}", event.getTaskId());

        Pomodoro pomodoro = pomodoroRepository.findPomodoroByAssociatedTaskId(event.getTaskId()).orElseThrow(() -> new IllegalStateException("No pomodoro found for task."));
        if (pomodoro == null) {
            log.warn("No pomodoro found for task: {}", event.getTaskId());
            return;
        }

        pomodoro.setCurrentFocusNumber(pomodoro.getCurrentFocusNumber() + 1);
        pomodoro.setSessionActive(true);
        pomodoro.setSessionRunning(true);
        pomodoroRepository.save(pomodoro);

        pausePomodoroUpdates(event.getTaskId());
        startPomodoroUpdates(event.getTaskId());
        sendAsyncUpdate(event.getTaskId());
    }

    @EventListener
    public void handleSessionPaused(SessionPausedEvent event) {
        if (!event.isPomodoro()) return;

        log.info("Handling session paused event for pomodoro task: {}", event.getTaskId());

        Pomodoro pomodoro = pomodoroRepository.findPomodoroByAssociatedTaskId(event.getTaskId()).orElseThrow(() -> new IllegalStateException("No pomodoro found for task."));
        if (pomodoro == null) return;

        pomodoro.setSessionRunning(false);
        String taskId = pomodoro.getAssociatedTaskId();
        Optional<Session> activeSession = sessionRepository
                .findSessionByAssociatedTaskIdAndActiveIsTrue(taskId);
        List<ScheduledJob> pastJobs = scheduledJobRepository
                .findAllByScheduledIsFalseAndAssociatedTaskId(taskId);
        Optional<ScheduledJob> nextJob = scheduledJobRepository
                .findAllByScheduledIsTrueAndAssociatedTaskId(taskId)
                .stream()
                .min(Comparator.comparing(ScheduledJob::getDueDate));
        pomodoro.setSecondsPassedInSession(calculateSecondsPassedInSession(activeSession, pastJobs));
        if (nextJob.isPresent()) {
            long secondsUntilNext = ChronoUnit.SECONDS.between(LocalDateTime.now(), nextJob.get().getDueDate());
            pomodoro.setSecondsUntilNextTransition(secondsUntilNext);
        }
        pomodoroRepository.save(pomodoro);

        scheduleService.unscheduleTaskJobs(event.getTaskId());
        pausePomodoroUpdates(event.getTaskId());
        sendAsyncUpdate(event.getTaskId());
    }

    @EventListener
    public void handleSessionUnpaused(SessionUnpausedEvent event) {
        if (!event.isPomodoro()) return;

        log.info("Handling session unpaused event for pomodoro task: {}", event.getTaskId());

        Pomodoro pomodoro = pomodoroRepository.findPomodoroByAssociatedTaskId(event.getTaskId()).orElseThrow(() -> new IllegalStateException("No pomodoro found for task."));
        if (pomodoro == null) return;

        // Shift scheduled jobs by pause duration
        scheduleService.shiftTaskJobDueDates(
                event.getTaskId(),
                (int) event.getPauseDuration().toSeconds()
        );
        scheduleService.rescheduleTaskJobs(event.getTaskId());

        pomodoro.setSessionRunning(true);
        pomodoroRepository.save(pomodoro);

        startPomodoroUpdates(event.getTaskId());
        sendAsyncUpdate(event.getTaskId());
    }

    @EventListener
    public void handleSessionEnded(SessionEndedEvent event) {
        if (!event.isPomodoro()) return;

        log.info("Handling session ended event for pomodoro task: {}", event.getTaskId());

        Pomodoro pomodoro = pomodoroRepository.findPomodoroByAssociatedTaskId(event.getTaskId()).orElseThrow(() -> new IllegalStateException("No pomodoro found for task."));
        if (pomodoro == null) return;

        pomodoro.setSecondsPassedInSession(0);
        pomodoro.setSessionActive(false);
        pomodoro.setSessionRunning(false);
        pomodoroRepository.save(pomodoro);

        pausePomodoroUpdates(event.getTaskId());

        // Continue updates if more focus sessions remain
        if (pomodoro.getCurrentFocusNumber() < pomodoro.getNumFocuses()) {
            startPomodoroUpdates(event.getTaskId());
        }
    }

    // ============ Pomodoro-Specific Logic ============

    public void startPomodoro(String taskId, int focusDuration,
                                  int shortBreakDuration, int longBreakDuration,
                                  int numFocuses, int longBreakCooldown) {

        createPomodoro(taskId, focusDuration, shortBreakDuration,
                longBreakDuration, numFocuses, longBreakCooldown);

        scheduleService.schedulePomoJobs(taskId);
        sessionService.startSession(taskId, true);
        startPomodoroUpdates(taskId);
    }

    public void endPomodoro(String taskId) {
        Pomodoro pomodoro = pomodoroRepository.findPomodoroByAssociatedTaskId(taskId).orElseThrow(() -> new IllegalStateException("No pomodoro found for task."));
        if (pomodoro == null) {
            log.warn("No pomodoro found for task: {}", taskId);
            return;
        }

        pomodoro.setSessionRunning(false);
        pomodoro.setSessionActive(false);
        pomodoro.setActive(false);
        pomodoroRepository.save(pomodoro);

        scheduleService.deleteTaskJobs(taskId);
        pausePomodoroUpdates(taskId);
        sendAsyncUpdate(taskId);

        pomodoroRepository.delete(pomodoro);
    }

    public Pomodoro createPomodoro(String associatedTaskId, int focusDuration,
                                   int shortBreakDuration, int longBreakDuration,
                                   int numFocuses, int longBreakCooldown) {
        Pomodoro pomodoro = new Pomodoro();
        pomodoro.setPomodoroId(UUID.randomUUID().toString());
        pomodoro.setAssociatedTaskId(associatedTaskId);
        pomodoro.setActive(true);
        pomodoro.setFocusDuration(focusDuration);
        pomodoro.setShortBreakDuration(shortBreakDuration);
        pomodoro.setLongBreakDuration(longBreakDuration);
        pomodoro.setNumFocuses(numFocuses);
        pomodoro.setLongBreakCooldown(longBreakCooldown);
        pomodoro.setSessionActive(false);
        pomodoro.setSessionRunning(false);
        pomodoro.setCurrentFocusNumber(0);
        pomodoro.setSecondsPassedInSession(0);

        return pomodoroRepository.save(pomodoro);
    }

    // ============ Update Management ============

    public void startPomodoroUpdates(String taskId) {
        // Prevent duplicate scheduling
        if (statusUpdateTasks.containsKey(taskId)) {
            log.debug("Updates already scheduled for task: {}", taskId);
            return;
        }

        Pomodoro pomodoro = pomodoroRepository.findPomodoroByAssociatedTaskId(taskId).orElseThrow(() -> new IllegalStateException("No pomodoro found for task."));
        if (pomodoro == null || !pomodoro.isActive()) {
            log.warn("Cannot start updates: pomodoro not found or inactive for task: {}", taskId);
            return;
        }

        ScheduledFuture<?> future = schedulerConfig.taskScheduler().scheduleAtFixedRate(() -> {
            try {
                updateAndBroadcastPomodoro(taskId);
            } catch (Exception e) {
                log.error("Error updating pomodoro for task: {}", taskId, e);
            }
        }, 100);

        statusUpdateTasks.put(taskId, future);
        log.info("Started pomodoro updates for task: {}", taskId);
    }

    public void pausePomodoroUpdates(String taskId) {
        ScheduledFuture<?> future = statusUpdateTasks.remove(taskId);
        if (future != null) {
            future.cancel(false);
            log.info("Paused pomodoro updates for task: {}", taskId);
        }
    }

    private void updateAndBroadcastPomodoro(String taskId) {
        Pomodoro pomodoro = pomodoroRepository.findPomodoroByAssociatedTaskId(taskId).orElseThrow(() -> new IllegalStateException("No pomodoro found for task."));
        if (pomodoro == null) {
            pausePomodoroUpdates(taskId);
            return;
        }

        Optional<Session> activeSession = sessionRepository
                .findSessionByAssociatedTaskIdAndActiveIsTrue(taskId);
        List<ScheduledJob> pastJobs = scheduledJobRepository
                .findAllByScheduledIsFalseAndAssociatedTaskId(taskId);
        Optional<ScheduledJob> nextJob = scheduledJobRepository
                .findAllByScheduledIsTrueAndAssociatedTaskId(taskId)
                .stream()
                .min(Comparator.comparing(ScheduledJob::getDueDate));

        if (nextJob.isEmpty()) {
            pausePomodoroUpdates(taskId);
            return;
        }

        // Calculate progress
        long secondsPassed = calculateSecondsPassedInSession(activeSession, pastJobs);
        long secondsUntilNext = ChronoUnit.SECONDS.between(LocalDateTime.now(), nextJob.get().getDueDate());

        pomodoro.setSecondsPassedInSession(secondsPassed);
        pomodoro.setSecondsUntilNextTransition(secondsUntilNext);

        // Broadcast without saving to DB
        simpMessagingTemplate.convertAndSend("/topic/pomodoro/" + taskId, pomodoro);
    }

    private long calculateSecondsPassedInSession(Optional<Session> activeSession,
                                                 List<ScheduledJob> pastJobs) {
        if (activeSession.isPresent()) {
            Session session = activeSession.get();
            long totalSeconds = session.getTotalSessionTime().toSeconds();
            if (session.isRunning()) {
                totalSeconds += Duration.between(session.getLastUnpauseTime(), LocalDateTime.now()).toSeconds();
            }
            return totalSeconds;
        } else if (!pastJobs.isEmpty()) {
            ScheduledJob previousJob = pastJobs.stream()
                    .max(Comparator.comparing(ScheduledJob::getDueDate))
                    .get();
            return Duration.between(previousJob.getDueDate(), LocalDateTime.now()).toSeconds();
        }
        return 0;
    }

    public void sendAsyncUpdate(String taskId) {
        log.debug("Sending async update for task: {}", taskId);
        Pomodoro pomodoro = pomodoroRepository.findPomodoroByAssociatedTaskId(taskId).orElseThrow(() -> new IllegalStateException("No pomodoro found for task."));
        simpMessagingTemplate.convertAndSend("/topic/pomodoro/" + taskId, pomodoro);

    }
}