package org.osama.session;

import lombok.extern.slf4j.Slf4j;
import org.osama.session.events.SessionEndedEvent;
import org.osama.session.events.SessionPausedEvent;
import org.osama.session.events.SessionStartedEvent;
import org.osama.session.events.SessionUnpausedEvent;
import org.osama.task.TaskRepository;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
public class SessionService {
    private final TaskRepository taskRepository;
    private final SessionRepository sessionRepository;
    private final ApplicationEventPublisher eventPublisher;

    public SessionService(TaskRepository taskRepository,
                          SessionRepository sessionRepository, ApplicationEventPublisher eventPublisher) {
        this.taskRepository = taskRepository;
        this.sessionRepository = sessionRepository;
        this.eventPublisher = eventPublisher;
    }

    public TaskSession startSession(String taskId, boolean isPomodoro) {
        taskRepository.findTaskByTaskId(taskId)
                .orElseThrow(() -> new IllegalArgumentException("Task not found: " + taskId));

        // Validate no active session exists
        Optional<TaskSession> existingSession = sessionRepository
                .findSessionByAssociatedTaskIdAndActiveIsTrue(taskId);
        if (existingSession.isPresent()) {
            throw new IllegalStateException("Cannot start a session when a task already has an active session.");
        }

        // Create session
        TaskSession taskSession = new TaskSession();
        taskSession.setSessionId(UUID.randomUUID().toString());
        taskSession.setAssociatedTaskId(taskId);
        taskSession.setStartTime(LocalDateTime.now());
        taskSession.setTotalSessionTime(Duration.ZERO);
        taskSession.setLastUnpauseTime(taskSession.getStartTime());
        taskSession.setActive(true);
        taskSession.setRunning(true);
        taskSession.setPomodoro(isPomodoro);

        TaskSession savedTaskSession = sessionRepository.save(taskSession);
        log.info("Started session [{}] for task [{}]", savedTaskSession.getSessionId(), taskId);

        // Publish event (Pomodoro will listen to this)
        eventPublisher.publishEvent(new SessionStartedEvent(
                taskId,
                savedTaskSession.getSessionId(),
                isPomodoro,
                LocalDateTime.now()
        ));

        return savedTaskSession;
    }

    public void pauseSession(String taskId) {
        taskRepository.findTaskByTaskId(taskId)
                .orElseThrow(() -> new IllegalArgumentException("Cannot pause session. Task not found: " + taskId));

        TaskSession taskSession = sessionRepository.findSessionByAssociatedTaskIdAndRunningIsTrue(taskId)
                .orElseThrow(() -> new IllegalStateException("No running session found for task: " + taskId));

        // Update session state
        Duration elapsedTime = Duration.between(taskSession.getLastUnpauseTime(), LocalDateTime.now());
        taskSession.setRunning(false);
        taskSession.setTotalSessionTime(taskSession.getTotalSessionTime().plus(elapsedTime));
        taskSession.setLastPauseTime(LocalDateTime.now());
        sessionRepository.save(taskSession);

        log.info("Paused session [{}] for task [{}]", taskSession.getSessionId(), taskId);

        // Publish event
        eventPublisher.publishEvent(new SessionPausedEvent(
                taskId,
                taskSession.getSessionId(),
                taskSession.isPomodoro(),
                LocalDateTime.now()
        ));
    }

    public void unpauseSession(String taskId) {
        taskRepository.findTaskByTaskId(taskId)
                .orElseThrow(() -> new IllegalArgumentException("Task not found: " + taskId));

        // Verify no running session
        Optional<TaskSession> runningSession = sessionRepository
                .findSessionByAssociatedTaskIdAndRunningIsTrue(taskId);
        if (runningSession.isPresent()) {
            throw new IllegalStateException("Cannot unpause: task already has a running session.");
        }

        TaskSession taskSession = sessionRepository.findSessionByAssociatedTaskIdAndActiveIsTrue(taskId)
                .orElseThrow(() -> new IllegalStateException("No active session found for task: " + taskId));

        Duration pauseDuration = Duration.between(taskSession.getLastPauseTime(), LocalDateTime.now());

        taskSession.setRunning(true);
        taskSession.setLastUnpauseTime(LocalDateTime.now());
        sessionRepository.save(taskSession);

        log.info("Unpaused session [{}] for task [{}]", taskSession.getSessionId(), taskId);

        // Publish event
        eventPublisher.publishEvent(new SessionUnpausedEvent(
                taskId,
                taskSession.getSessionId(),
                taskSession.isPomodoro(),
                pauseDuration,
                LocalDateTime.now()
        ));
    }

    public void endSession(String taskId) {
        taskRepository.findTaskByTaskId(taskId)
                .orElseThrow(() -> new IllegalArgumentException("Task not found: " + taskId));

        TaskSession taskSession = sessionRepository.findSessionByAssociatedTaskIdAndActiveIsTrue(taskId)
                .orElseThrow(() -> new IllegalStateException("No active session found for task: " + taskId));

        // Calculate final time
        if (taskSession.isRunning()) {
            Duration elapsedTime = Duration.between(taskSession.getLastUnpauseTime(), LocalDateTime.now());
            taskSession.setTotalSessionTime(taskSession.getTotalSessionTime().plus(elapsedTime));
        }

        taskSession.setEndTime(LocalDateTime.now());
        taskSession.setRunning(false);
        taskSession.setActive(false);
        sessionRepository.save(taskSession);

        log.info("Ended session [{}] for task [{}]. Total time: {}",
                taskSession.getSessionId(), taskId, taskSession.getTotalSessionTime());

        // Publish event
        eventPublisher.publishEvent(new SessionEndedEvent(
                taskId,
                taskSession.getSessionId(),
                taskSession.isPomodoro(),
                taskSession.getTotalSessionTime(),
                LocalDateTime.now()
        ));
    }

}
