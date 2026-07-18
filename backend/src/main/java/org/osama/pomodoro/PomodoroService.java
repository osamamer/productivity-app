package org.osama.pomodoro;

import lombok.extern.slf4j.Slf4j;
import org.osama.scheduling.ScheduleService;
import org.osama.scheduling.ScheduledJob;
import org.osama.scheduling.ScheduledJobRepository;
import org.osama.scheduling.SchedulerConfig;
import org.osama.session.events.SessionEndedEvent;
import org.osama.session.events.SessionPausedEvent;
import org.osama.session.events.SessionStartedEvent;
import org.osama.session.events.SessionUnpausedEvent;
import org.osama.session.task.TaskSession;
import org.osama.session.task.TaskSessionRepository;
import org.osama.session.task.TaskSessionService;
import org.osama.task.Task;
import org.osama.task.TaskService;
import org.osama.user.User;
import org.osama.user.UserRepository;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledFuture;

@Slf4j
@Service
public class PomodoroService {
    private final PomodoroRepository pomodoroRepository;
    private final ScheduledJobRepository scheduledJobRepository;
    private final TaskSessionRepository taskSessionRepository;
    private final ScheduleService scheduleService;
    private final SchedulerConfig schedulerConfig;
    private final SimpMessagingTemplate simpMessagingTemplate;
    private final TaskSessionService taskSessionService;
    private final TaskService taskService;
    private final UserRepository userRepository;

    private final Map<String, ScheduledFuture<?>> statusUpdateTasks = new ConcurrentHashMap<>();

    public PomodoroService(PomodoroRepository pomodoroRepository,
                           ScheduledJobRepository scheduledJobRepository,
                           TaskSessionRepository taskSessionRepository,
                           ScheduleService scheduleService,
                           SchedulerConfig schedulerConfig,
                           SimpMessagingTemplate simpMessagingTemplate,
                           TaskSessionService taskSessionService,
                           TaskService taskService,
                           UserRepository userRepository) {
        this.pomodoroRepository = pomodoroRepository;
        this.scheduledJobRepository = scheduledJobRepository;
        this.taskSessionRepository = taskSessionRepository;
        this.scheduleService = scheduleService;
        this.schedulerConfig = schedulerConfig;
        this.simpMessagingTemplate = simpMessagingTemplate;
        this.taskSessionService = taskSessionService;
        this.taskService = taskService;
        this.userRepository = userRepository;
    }

    // ============ Event Listeners ============

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void handleSessionStarted(SessionStartedEvent event) {
        if (!event.isPomodoro()) return;

        log.info("Handling session started event for pomodoro task: {}", event.getTaskId());

        Pomodoro pomodoro = pomodoroRepository.findPomodoroByAssociatedTaskIdAndIsActiveIsTrue(event.getTaskId())
                .orElseThrow(() -> new IllegalStateException("No pomodoro found for task."));

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

        Pomodoro pomodoro = pomodoroRepository.findPomodoroByAssociatedTaskIdAndIsActiveIsTrue(event.getTaskId())
                .orElseThrow(() -> new IllegalStateException("No pomodoro found for task."));

        pomodoro.setSessionRunning(false);
        String taskId = pomodoro.getAssociatedTaskId();
        Optional<TaskSession> activeSession = taskSessionRepository
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

        Pomodoro pomodoro = pomodoroRepository.findPomodoroByAssociatedTaskIdAndIsActiveIsTrue(event.getTaskId())
                .orElseThrow(() -> new IllegalStateException("No pomodoro found for task."));

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

        Pomodoro pomodoro = pomodoroRepository.findPomodoroByAssociatedTaskIdAndIsActiveIsTrue(event.getTaskId())
                .orElseThrow(() -> new IllegalStateException("No pomodoro found for task."));

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

    @Transactional
    public void startPomodoro(String taskId, int focusDuration,
                              int shortBreakDuration, int longBreakDuration,
                              int numFocuses, int longBreakCooldown, String userId) {
        Task task = taskService.getTaskForUserOrThrow(taskId, userId);
        validateStartRequest(task, focusDuration, shortBreakDuration, longBreakDuration,
                numFocuses, longBreakCooldown, userId);

        createPomodoro(task.getTaskId(), focusDuration, shortBreakDuration,
                longBreakDuration, numFocuses, longBreakCooldown, userId);

        scheduleService.schedulePomoJobs(task.getTaskId());
        taskSessionService.startSession(task.getTaskId(), true);
    }

    @Transactional
    public void endPomodoro(String taskId, String userId) {
        Task task = taskService.getTaskForUserOrThrow(taskId, userId);

        Pomodoro pomodoro = getOwnedActivePomodoro(task.getTaskId(), userId);

        if (taskSessionRepository.existsByAssociatedTaskIdAndActiveIsTrue(task.getTaskId())) {
            taskSessionService.endSession(task.getTaskId());
        }

        pomodoro.setActive(false);
        pomodoro.setSessionRunning(false);
        pomodoro.setSessionActive(false);
        pomodoroRepository.save(pomodoro);

        scheduleService.deleteTaskJobs(task.getTaskId());
        pausePomodoroUpdates(task.getTaskId());
        sendUpdate(pomodoro);
    }

    @Transactional
    public void endPomodoro(String taskId) {
        Pomodoro pomodoro = pomodoroRepository.findPomodoroByAssociatedTaskIdAndIsActiveIsTrue(taskId)
                .orElseThrow(() -> new IllegalStateException("No pomodoro found for task."));
        endPomodoro(taskId, pomodoro.getUser().getId());
    }

    public Pomodoro createPomodoro(String associatedTaskId, int focusDuration,
                                   int shortBreakDuration, int longBreakDuration,
                                   int numFocuses, int longBreakCooldown, String userId) {
        User user = userRepository.findUserById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

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
        pomodoro.setUser(user);

        return pomodoroRepository.save(pomodoro);
    }

    private void validateStartRequest(Task task, int focusDuration,
                                      int shortBreakDuration, int longBreakDuration,
                                      int numFocuses, int longBreakCooldown, String userId) {
        if (focusDuration <= 0) {
            throw new IllegalArgumentException("Focus duration must be positive.");
        }
        if (shortBreakDuration <= 0) {
            throw new IllegalArgumentException("Short break duration must be positive.");
        }
        if (longBreakDuration <= 0) {
            throw new IllegalArgumentException("Long break duration must be positive.");
        }
        if (numFocuses <= 0) {
            throw new IllegalArgumentException("Number of focuses must be positive.");
        }
        if (longBreakCooldown <= 0) {
            throw new IllegalArgumentException("Long break cooldown must be positive.");
        }
        if (pomodoroRepository.existsByAssociatedTaskIdAndUserIdAndIsActiveIsTrue(task.getTaskId(), userId)) {
            throw new IllegalStateException("Task already has an active pomodoro.");
        }
        if (taskSessionRepository.existsByAssociatedTaskIdAndActiveIsTrue(task.getTaskId())) {
            throw new IllegalStateException("Cannot start a pomodoro while the task already has an active session.");
        }
    }

    private Pomodoro getOwnedActivePomodoro(String taskId, String userId) {
        return pomodoroRepository.findPomodoroByAssociatedTaskIdAndUserIdAndIsActiveIsTrue(taskId, userId)
                .orElseThrow(() -> new IllegalStateException("No pomodoro found for task."));
    }

    // ============ Update Management ============

    public void startPomodoroUpdates(String taskId) {
        // Prevent duplicate scheduling
        if (statusUpdateTasks.containsKey(taskId)) {
            log.debug("Updates already scheduled for task: {}", taskId);
            return;
        }

        Optional<Pomodoro> pomodoro = pomodoroRepository.findPomodoroByAssociatedTaskIdAndIsActiveIsTrue(taskId);
        if (pomodoro.isEmpty()) {
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
        Optional<Pomodoro> activePomodoro =
                pomodoroRepository.findPomodoroByAssociatedTaskIdAndIsActiveIsTrue(taskId);
        if (activePomodoro.isEmpty()) {
            pausePomodoroUpdates(taskId);
            return;
        }
        Pomodoro pomodoro = activePomodoro.get();

        Optional<TaskSession> activeSession = taskSessionRepository
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

    private long calculateSecondsPassedInSession(Optional<TaskSession> activeSession,
                                                 List<ScheduledJob> pastJobs) {
        if (activeSession.isPresent()) {
            TaskSession taskSession = activeSession.get();
            long totalSeconds = taskSession.getTotalSessionTime().toSeconds();
            if (taskSession.isRunning()) {
                totalSeconds += Duration.between(taskSession.getLastUnpauseTime(), LocalDateTime.now()).toSeconds();
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
        Pomodoro pomodoro = pomodoroRepository.findPomodoroByAssociatedTaskIdAndIsActiveIsTrue(taskId)
                .orElseThrow(() -> new IllegalStateException("No pomodoro found for task."));
        sendUpdate(pomodoro);
    }

    public Optional<Pomodoro> getActivePomodoro(String taskId, String userId) {
        Task task = taskService.getTaskForUserOrThrow(taskId, userId);
        return pomodoroRepository.findPomodoroByAssociatedTaskIdAndUserIdAndIsActiveIsTrue(task.getTaskId(), userId);
    }

    private void sendUpdate(Pomodoro pomodoro) {
        simpMessagingTemplate.convertAndSend("/topic/pomodoro/" + pomodoro.getAssociatedTaskId(), pomodoro);
    }
}
