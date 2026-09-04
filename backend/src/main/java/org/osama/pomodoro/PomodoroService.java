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
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.atomic.AtomicReference;

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
    private final PomodoroSettings pomodoroSettings;

    private final Map<String, ScheduledFuture<?>> statusUpdateTasks = new ConcurrentHashMap<>();

    public PomodoroService(PomodoroRepository pomodoroRepository,
                           ScheduledJobRepository scheduledJobRepository,
                           TaskSessionRepository taskSessionRepository,
                           ScheduleService scheduleService,
                           SchedulerConfig schedulerConfig,
                           SimpMessagingTemplate simpMessagingTemplate,
                           TaskSessionService taskSessionService,
                           TaskService taskService,
                           UserRepository userRepository,
                           PomodoroSettings pomodoroSettings) {
        this.pomodoroRepository = pomodoroRepository;
        this.scheduledJobRepository = scheduledJobRepository;
        this.taskSessionRepository = taskSessionRepository;
        this.scheduleService = scheduleService;
        this.schedulerConfig = schedulerConfig;
        this.simpMessagingTemplate = simpMessagingTemplate;
        this.taskSessionService = taskSessionService;
        this.taskService = taskService;
        this.userRepository = userRepository;
        this.pomodoroSettings = pomodoroSettings;
    }

    public PomodoroConfigResponse getConfig() {
        return new PomodoroConfigResponse(
                pomodoroSettings.isDevSecondsMode(),
                pomodoroSettings.getDurationUnit(),
                pomodoroSettings.getDefaultFocusDuration(),
                pomodoroSettings.getDefaultShortBreakDuration(),
                pomodoroSettings.getDefaultLongBreakDuration()
        );
    }

    // ============ Event Listeners ============

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void handleSessionStarted(SessionStartedEvent event) {
        if (!event.isPomodoro()) return;

        log.info("Handling session started event for pomodoro task: {}", event.getTaskId());

        Pomodoro pomodoro = pomodoroRepository.findPomodoroByAssociatedTaskIdAndIsActiveIsTrue(event.getTaskId())
                .orElseThrow(() -> new IllegalStateException("No pomodoro found for task."));

        pomodoro.setCurrentFocusNumber(pomodoro.getCurrentFocusNumber() + 1);
        pomodoro.setSessionActive(true);
        pomodoro.setSessionRunning(true);
        pomodoro.setPhase(PomodoroPhase.FOCUS);
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
        Optional<ScheduledJob> nextJob = scheduledJobRepository
                .findAllByScheduledIsTrueAndAssociatedTaskId(taskId)
                .stream()
                .min(Comparator.comparing(ScheduledJob::getDueDate));
        pomodoro.setSecondsPassedInSession(calculateFocusSecondsPassed(activeSession));
        if (nextJob.isPresent()) {
            pomodoro.setSecondsUntilNextTransition(
                    calculateSecondsUntil(nextJob.get().getDueDate(), LocalDateTime.now()));
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

        LocalDateTime pauseStartedAt = event.getTimestamp().minus(event.getPauseDuration());
        scheduleService.resumeTaskJobs(event.getTaskId(), pauseStartedAt, event.getPauseDuration());

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
        if (pomodoro.getCurrentFocusNumber() < pomodoro.getNumFocuses()) {
            pomodoro.setPhase(pomodoro.isAutoStartSessions()
                    ? PomodoroPhase.BREAK
                    : PomodoroPhase.WAITING_FOR_BREAK);
        }
        pomodoroRepository.save(pomodoro);

        pausePomodoroUpdates(event.getTaskId());

        // Continue updates if more focus sessions remain
        if (pomodoro.getCurrentFocusNumber() < pomodoro.getNumFocuses()
                && pomodoro.isAutoStartSessions()) {
            startPomodoroUpdates(event.getTaskId());
        }
        if (pomodoro.getCurrentFocusNumber() < pomodoro.getNumFocuses()) {
            sendAsyncUpdate(event.getTaskId());
        }
    }

    // ============ Pomodoro-Specific Logic ============

    @Transactional
    public void startPomodoro(String taskId, int focusDuration,
                              int shortBreakDuration, int longBreakDuration,
                              int numFocuses, int longBreakCooldown, String userId) {
        startPomodoro(taskId, focusDuration, shortBreakDuration, longBreakDuration,
                numFocuses, longBreakCooldown, null, userId);
    }

    @Transactional
    public void startPomodoro(String taskId, int focusDuration,
                              int shortBreakDuration, int longBreakDuration,
                              int numFocuses, int longBreakCooldown,
                              Boolean secondsMode, String userId) {
        Task task = taskService.getTaskForUserOrThrow(taskId, userId);
        validateStartRequest(task, focusDuration, shortBreakDuration, longBreakDuration,
                numFocuses, longBreakCooldown, userId);

        Pomodoro pomodoro = createPomodoro(task.getTaskId(), focusDuration, shortBreakDuration,
                longBreakDuration, numFocuses, longBreakCooldown, userId);

        boolean effectiveSecondsMode = secondsMode != null ? secondsMode : pomodoroSettings.isDevSecondsMode();
        pomodoro.setSecondsMode(effectiveSecondsMode);
        pomodoroRepository.save(pomodoro);
        scheduleService.schedulePomoJobs(task.getTaskId(), effectiveSecondsMode);
        taskSessionService.startSession(task.getTaskId(), true);
        log.info("Pomodoro started: userId={} taskId={} focusDuration={} shortBreakDuration={} longBreakDuration={} numFocuses={} longBreakCooldown={} secondsMode={}",
                userId, taskId, focusDuration, shortBreakDuration, longBreakDuration, numFocuses, longBreakCooldown,
                effectiveSecondsMode);
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
        log.info("Pomodoro ended: userId={} taskId={} completedFocusCount={}",
                userId, taskId, pomodoro.getCurrentFocusNumber());
    }

    @Transactional
    public void startNextPhase(String taskId, String userId) {
        Task task = taskService.getTaskForUserOrThrow(taskId, userId);
        Pomodoro pomodoro = getOwnedActivePomodoro(task.getTaskId(), userId);
        if (pomodoro.isAutoStartSessions()) {
            throw new IllegalStateException("This Pomodoro is configured to start phases automatically.");
        }

        PomodoroPhase phase = currentPhase(pomodoro);
        if (phase == PomodoroPhase.WAITING_FOR_BREAK) {
            pomodoro.setPhase(PomodoroPhase.BREAK);
            pomodoro.setSecondsPassedInSession(0);
            pomodoro.setSecondsUntilNextTransition(0);
            pomodoroRepository.save(pomodoro);
            scheduleService.scheduleBreakEnd(task.getTaskId());
            pausePomodoroUpdates(task.getTaskId());
            startPomodoroUpdates(task.getTaskId());
            sendAsyncUpdate(task.getTaskId());
            log.info("Pomodoro break started manually: userId={} taskId={} focusNumber={}",
                    userId, taskId, pomodoro.getCurrentFocusNumber());
            return;
        }

        if (phase == PomodoroPhase.WAITING_FOR_FOCUS) {
            pomodoro.setPhase(PomodoroPhase.FOCUS);
            pomodoro.setSecondsPassedInSession(0);
            pomodoro.setSecondsUntilNextTransition(0);
            pomodoroRepository.save(pomodoro);
            scheduleService.scheduleFocusEnd(task.getTaskId());
            taskSessionService.startSession(task.getTaskId(), true);
            log.info("Pomodoro focus started manually: userId={} taskId={} nextFocusNumber={}",
                    userId, taskId, pomodoro.getCurrentFocusNumber() + 1);
            return;
        }

        throw new IllegalStateException("Pomodoro is not waiting for a phase to start.");
    }

    @Transactional
    public void advanceFromBreak(String taskId) {
        Pomodoro pomodoro = pomodoroRepository.findPomodoroByAssociatedTaskIdAndIsActiveIsTrue(taskId)
                .orElseThrow(() -> new IllegalStateException("No active pomodoro found for task."));
        if (pomodoro.isAutoStartSessions()) {
            taskSessionService.startSession(taskId, true);
            return;
        }

        if (currentPhase(pomodoro) != PomodoroPhase.BREAK) {
            return;
        }

        pomodoro.setPhase(PomodoroPhase.WAITING_FOR_FOCUS);
        pomodoro.setSecondsPassedInSession(0);
        pomodoro.setSecondsUntilNextTransition(0);
        pomodoroRepository.save(pomodoro);
        pausePomodoroUpdates(taskId);
        sendUpdate(pomodoro);
        log.info("Pomodoro waiting for manual focus start: taskId={} focusNumber={}",
                taskId, pomodoro.getCurrentFocusNumber() + 1);
    }

    @Transactional
    public void finishBreakEarly(String taskId, String userId) {
        Task task = taskService.getTaskForUserOrThrow(taskId, userId);
        Pomodoro pomodoro = getOwnedActivePomodoro(task.getTaskId(), userId);
        if (currentPhase(pomodoro) != PomodoroPhase.BREAK) {
            throw new IllegalStateException("Pomodoro is not in an active break.");
        }
        if (pomodoro.getCurrentFocusNumber() >= pomodoro.getNumFocuses()) {
            throw new IllegalStateException("Pomodoro has no remaining focus sessions.");
        }

        pausePomodoroUpdates(taskId);
        scheduleService.finishBreakEarly(taskId);
        pomodoro.setPhase(PomodoroPhase.FOCUS);
        pomodoro.setSecondsPassedInSession(0);
        pomodoro.setSecondsUntilNextTransition(
                pomodoroSettings.durationInSeconds(pomodoro.getFocusDuration(), pomodoro.isSecondsMode()));
        pomodoroRepository.save(pomodoro);
        taskSessionService.startSession(taskId, true);
        log.info("Pomodoro next focus started after early break: userId={} taskId={} nextFocusNumber={}",
                userId, taskId, pomodoro.getCurrentFocusNumber() + 1);
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
        pomodoro.setPhase(PomodoroPhase.FOCUS);
        pomodoro.setAutoStartSessions(!Boolean.FALSE.equals(user.getAutoStartPomodoroSessions()));
        pomodoro.setUser(user);

        Pomodoro savedPomodoro = pomodoroRepository.save(pomodoro);
        log.info("Pomodoro configured: userId={} pomodoroId={} taskId={} focusDuration={} shortBreakDuration={} longBreakDuration={} numFocuses={} longBreakCooldown={}",
                userId, savedPomodoro.getPomodoroId(), associatedTaskId, focusDuration,
                shortBreakDuration, longBreakDuration, numFocuses, longBreakCooldown);
        return savedPomodoro;
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
        if (pomodoroRepository.existsByUserIdAndIsActiveIsTrue(userId)) {
            throw new IllegalStateException("Cannot start a pomodoro while another pomodoro is active.");
        }
        if (taskSessionRepository.existsByAssociatedTaskIdAndActiveIsTrue(task.getTaskId())) {
            throw new IllegalStateException("Cannot start a pomodoro while the task already has an active session.");
        }
    }

    private Pomodoro getOwnedActivePomodoro(String taskId, String userId) {
        return pomodoroRepository.findPomodoroByAssociatedTaskIdAndUserIdAndIsActiveIsTrue(taskId, userId)
                .orElseThrow(() -> new IllegalStateException("No pomodoro found for task."));
    }

    private PomodoroPhase currentPhase(Pomodoro pomodoro) {
        if (pomodoro.getPhase() != null) {
            return pomodoro.getPhase();
        }
        return pomodoro.isSessionActive() ? PomodoroPhase.FOCUS : PomodoroPhase.BREAK;
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

        AtomicReference<ScheduledFuture<?>> currentFuture = new AtomicReference<>();
        ScheduledFuture<?> future = schedulerConfig.taskScheduler().scheduleAtFixedRate(
                () -> {
                    try {
                        if (!updateAndBroadcastPomodoro(taskId)) {
                            pausePomodoroUpdatesIfCurrent(taskId, currentFuture.get());
                        }
                    } catch (Exception e) {
                        log.error("Error updating pomodoro for task: {}", taskId, e);
                    }
                },
                Instant.now().plusSeconds(1),
                Duration.ofSeconds(1));

        currentFuture.set(future);
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

    private boolean updateAndBroadcastPomodoro(String taskId) {
        Optional<Pomodoro> activePomodoro =
                pomodoroRepository.findPomodoroByAssociatedTaskIdAndIsActiveIsTrue(taskId);
        if (activePomodoro.isEmpty()) {
            return false;
        }
        Pomodoro pomodoro = activePomodoro.get();

        if (!refreshCurrentStatus(pomodoro)) {
            return false;
        }

        // Broadcast without saving to DB
        simpMessagingTemplate.convertAndSend("/topic/pomodoro/" + taskId, pomodoro);
        return true;
    }

    private void pausePomodoroUpdatesIfCurrent(String taskId, ScheduledFuture<?> expectedFuture) {
        if (expectedFuture != null && statusUpdateTasks.remove(taskId, expectedFuture)) {
            expectedFuture.cancel(false);
            log.info("Paused pomodoro updates for task: {}", taskId);
        }
    }

    private long calculateFocusSecondsPassed(Optional<TaskSession> activeSession) {
        if (activeSession.isPresent()) {
            TaskSession taskSession = activeSession.get();
            long totalSeconds = taskSession.getTotalSessionTime().toSeconds();
            if (taskSession.isRunning()) {
                totalSeconds += Duration.between(taskSession.getLastUnpauseTime(), LocalDateTime.now()).toSeconds();
            }
            return totalSeconds;
        }
        return 0;
    }

    private long calculateSecondsUntil(LocalDateTime dueDate, LocalDateTime now) {
        long millisUntilDue = Duration.between(now, dueDate).toMillis();
        return millisUntilDue <= 0 ? 0 : (millisUntilDue + 999) / 1000;
    }

    private long calculateSecondsPassed(Pomodoro pomodoro,
                                        Optional<TaskSession> activeSession,
                                        long secondsUntilNext) {
        if (currentPhase(pomodoro) == PomodoroPhase.FOCUS) {
            return calculateFocusSecondsPassed(activeSession);
        }
        if (currentPhase(pomodoro) == PomodoroPhase.BREAK) {
            long breakDuration = pomodoro.getCurrentFocusNumber() % pomodoro.getLongBreakCooldown() == 0
                    ? pomodoroSettings.durationInSeconds(pomodoro.getLongBreakDuration(), pomodoro.isSecondsMode())
                    : pomodoroSettings.durationInSeconds(pomodoro.getShortBreakDuration(), pomodoro.isSecondsMode());
            return Math.max(0, Math.min(breakDuration, breakDuration - secondsUntilNext));
        }
        return 0;
    }

    public void sendAsyncUpdate(String taskId) {
        log.debug("Sending async update for task: {}", taskId);
        Pomodoro pomodoro = pomodoroRepository.findPomodoroByAssociatedTaskIdAndIsActiveIsTrue(taskId)
                .orElseThrow(() -> new IllegalStateException("No pomodoro found for task."));
        PomodoroPhase phase = currentPhase(pomodoro);
        boolean hasPendingTransition = !scheduledJobRepository
                .findAllByScheduledIsTrueAndAssociatedTaskId(taskId)
                .isEmpty();
        if (hasPendingTransition && (phase == PomodoroPhase.FOCUS || phase == PomodoroPhase.BREAK)) {
            updateAndBroadcastPomodoro(taskId);
            return;
        }
        sendUpdate(pomodoro);
    }

    public Optional<Pomodoro> getActivePomodoro(String taskId, String userId) {
        Task task = taskService.getTaskForUserOrThrow(taskId, userId);
        return pomodoroRepository.findPomodoroByAssociatedTaskIdAndUserIdAndIsActiveIsTrue(task.getTaskId(), userId)
                .map(pomodoro -> {
                    refreshCurrentStatus(pomodoro);
                    return pomodoro;
                });
    }

    public Optional<Pomodoro> getActivePomodoro(String userId) {
        return pomodoroRepository.findPomodoroByUserIdAndIsActiveIsTrue(userId)
                .map(pomodoro -> {
                    refreshCurrentStatus(pomodoro);
                    return pomodoro;
                });
    }

    /**
     * The countdown fields are a transport snapshot for WebSocket updates, not
     * the source of truth. Scheduled transition due dates are persisted so a
     * REST status request remains accurate after a client or backend restart.
     */
    private boolean refreshCurrentStatus(Pomodoro pomodoro) {
        Optional<TaskSession> activeSession = taskSessionRepository
                .findSessionByAssociatedTaskIdAndActiveIsTrue(pomodoro.getAssociatedTaskId());
        Optional<ScheduledJob> nextJob = scheduledJobRepository
                .findAllByScheduledIsTrueAndAssociatedTaskId(pomodoro.getAssociatedTaskId())
                .stream()
                .min(Comparator.comparing(ScheduledJob::getDueDate));
        if (nextJob.isEmpty()) {
            return false;
        }

        long secondsUntilNext = calculateSecondsUntil(nextJob.get().getDueDate(), LocalDateTime.now());
        pomodoro.setSecondsPassedInSession(calculateSecondsPassed(pomodoro, activeSession, secondsUntilNext));
        pomodoro.setSecondsUntilNextTransition(secondsUntilNext);
        return true;
    }

    private void sendUpdate(Pomodoro pomodoro) {
        simpMessagingTemplate.convertAndSend("/topic/pomodoro/" + pomodoro.getAssociatedTaskId(), pomodoro);
    }
}
