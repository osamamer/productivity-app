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

    public Session startSession(String taskId, boolean isPomodoro) {
        taskRepository.findTaskByTaskId(taskId)
                .orElseThrow(() -> new IllegalArgumentException("Task not found: " + taskId));

        // Validate no active session exists
        Optional<Session> existingSession = sessionRepository
                .findSessionByAssociatedTaskIdAndActiveIsTrue(taskId);
        if (existingSession.isPresent()) {
            throw new IllegalStateException("Cannot start a session when a task already has an active session.");
        }

        // Create session
        Session session = new Session();
        session.setSessionId(UUID.randomUUID().toString());
        session.setAssociatedTaskId(taskId);
        session.setStartTime(LocalDateTime.now());
        session.setTotalSessionTime(Duration.ZERO);
        session.setLastUnpauseTime(session.getStartTime());
        session.setActive(true);
        session.setRunning(true);
        session.setPomodoro(isPomodoro);

        Session savedSession = sessionRepository.save(session);
        log.info("Started session [{}] for task [{}]", savedSession.getSessionId(), taskId);

        // Publish event (Pomodoro will listen to this)
        eventPublisher.publishEvent(new SessionStartedEvent(
                taskId,
                savedSession.getSessionId(),
                isPomodoro,
                LocalDateTime.now()
        ));

        return savedSession;
    }

    public void pauseSession(String taskId) {
        taskRepository.findTaskByTaskId(taskId)
                .orElseThrow(() -> new IllegalArgumentException("Cannot pause session. Task not found: " + taskId));

        Session session = sessionRepository.findSessionByAssociatedTaskIdAndRunningIsTrue(taskId)
                .orElseThrow(() -> new IllegalStateException("No running session found for task: " + taskId));

        // Update session state
        Duration elapsedTime = Duration.between(session.getLastUnpauseTime(), LocalDateTime.now());
        session.setRunning(false);
        session.setTotalSessionTime(session.getTotalSessionTime().plus(elapsedTime));
        session.setLastPauseTime(LocalDateTime.now());
        sessionRepository.save(session);

        log.info("Paused session [{}] for task [{}]", session.getSessionId(), taskId);

        // Publish event
        eventPublisher.publishEvent(new SessionPausedEvent(
                taskId,
                session.getSessionId(),
                session.isPomodoro(),
                LocalDateTime.now()
        ));
    }

    public void unpauseSession(String taskId) {
        taskRepository.findTaskByTaskId(taskId)
                .orElseThrow(() -> new IllegalArgumentException("Task not found: " + taskId));

        // Verify no running session
        Optional<Session> runningSession = sessionRepository
                .findSessionByAssociatedTaskIdAndRunningIsTrue(taskId);
        if (runningSession.isPresent()) {
            throw new IllegalStateException("Cannot unpause: task already has a running session.");
        }

        Session session = sessionRepository.findSessionByAssociatedTaskIdAndActiveIsTrue(taskId)
                .orElseThrow(() -> new IllegalStateException("No active session found for task: " + taskId));

        Duration pauseDuration = Duration.between(session.getLastPauseTime(), LocalDateTime.now());

        session.setRunning(true);
        session.setLastUnpauseTime(LocalDateTime.now());
        sessionRepository.save(session);

        log.info("Unpaused session [{}] for task [{}]", session.getSessionId(), taskId);

        // Publish event
        eventPublisher.publishEvent(new SessionUnpausedEvent(
                taskId,
                session.getSessionId(),
                session.isPomodoro(),
                pauseDuration,
                LocalDateTime.now()
        ));
    }

    public void endSession(String taskId) {
        taskRepository.findTaskByTaskId(taskId)
                .orElseThrow(() -> new IllegalArgumentException("Task not found: " + taskId));

        Session session = sessionRepository.findSessionByAssociatedTaskIdAndActiveIsTrue(taskId)
                .orElseThrow(() -> new IllegalStateException("No active session found for task: " + taskId));

        // Calculate final time
        if (session.isRunning()) {
            Duration elapsedTime = Duration.between(session.getLastUnpauseTime(), LocalDateTime.now());
            session.setTotalSessionTime(session.getTotalSessionTime().plus(elapsedTime));
        }

        session.setEndTime(LocalDateTime.now());
        session.setRunning(false);
        session.setActive(false);
        sessionRepository.save(session);

        log.info("Ended session [{}] for task [{}]. Total time: {}",
                session.getSessionId(), taskId, session.getTotalSessionTime());

        // Publish event
        eventPublisher.publishEvent(new SessionEndedEvent(
                taskId,
                session.getSessionId(),
                session.isPomodoro(),
                session.getTotalSessionTime(),
                LocalDateTime.now()
        ));
    }

}
