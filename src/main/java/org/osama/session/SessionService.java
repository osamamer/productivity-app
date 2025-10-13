package org.osama.session;

import lombok.extern.slf4j.Slf4j;
import org.osama.PomodoroWebSocketService;
import org.osama.scheduling.ScheduleService;
import org.osama.task.Task;
import org.osama.task.TaskRepository;
import org.osama.task.TaskService;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
public class SessionService {
    private final TaskRepository taskRepository;
    private final SessionRepository sessionRepository;
    private final ScheduleService scheduleService;
    private final PomodoroWebSocketService pomodoroWebSocketService;
    private final TaskService taskService;

    public SessionService(TaskRepository taskRepository, SessionRepository sessionRepository, ScheduleService scheduleService, PomodoroWebSocketService pomodoroWebSocketService, TaskService taskService) {
        this.taskRepository = taskRepository;
        this.sessionRepository = sessionRepository;
        this.scheduleService = scheduleService;
        this.pomodoroWebSocketService = pomodoroWebSocketService;
        this.taskService = taskService;
    }
    private static Session createSession(Task task, boolean isPomodoro) {
        Session session = new Session();
        session.setSessionId(UUID.randomUUID().toString());
        session.setTaskId(task.getTaskId());
        session.setStartTime(LocalDateTime.now());
        session.setTotalSessionTime(Duration.ZERO);
        session.setLastUnpauseTime(session.getStartTime());
        session.setActive(true);
        session.setRunning(true);
        session.setPomodoro(isPomodoro);
        log.info("Created session for task with ID [{}]", task.getTaskId());
        return session;
    }
    public void startTaskSession(String taskId, boolean isPomodoro) {
        Task task = taskRepository.findTaskByTaskId(taskId);
        List<Session> activeSessions = sessionRepository.findAllByTaskIdAndActiveIsTrue(task.getTaskId());
        if (!activeSessions.isEmpty()) throw new IllegalStateException("Cannot start a session when a task is already active");
//        endAllSessions();
        Session session = createSession(task, isPomodoro);
        sessionRepository.save(session);
        log.info("Started session for task with ID [{}] on {}", task.getTaskId(), session.getStartTime());
    }
    public void pauseTaskSession(String taskId) {
        Task task = taskRepository.findTaskByTaskId(taskId);
        Optional<Session> session = sessionRepository.findSessionByTaskIdAndRunningIsTrue(taskId);
        Session activeSession = session.orElseThrow(() -> new IllegalStateException("Cannot pause task session because it is not running"));
        activeSession.setRunning(false);
        Duration elapsedTime = Duration.between(activeSession.getLastUnpauseTime(), LocalDateTime.now());
        activeSession.setTotalSessionTime(activeSession.getTotalSessionTime().plus(elapsedTime));
        activeSession.setLastPauseTime(LocalDateTime.now());
        sessionRepository.save(activeSession);
        if (activeSession.isPomodoro()) {
            scheduleService.unscheduleTaskJobs(taskId);
            pomodoroWebSocketService.sendPauseUpdate(taskId, true);
        }
        log.info("Paused task with ID [{}] on {}", task.getTaskId(), activeSession.getLastPauseTime());
    }
    public void unpauseTaskSession(String taskId) {
        Task task = taskRepository.findTaskByTaskId(taskId);
        Optional<Session> session = sessionRepository.findSessionByTaskIdAndRunningIsTrue(task.getTaskId());
        if (session.isPresent()) throw new IllegalStateException("Cannot unpause a session when the task is already running");
        session = sessionRepository.findSessionByTaskIdAndActiveIsTrue(taskId);
        Session activeSession = session.orElseThrow(() -> new IllegalStateException("Cannot unpause task session because it is not active"));
        activeSession.setRunning(true);
        activeSession.setLastUnpauseTime(LocalDateTime.now());
        sessionRepository.save(activeSession);
        if (activeSession.isPomodoro()) {
            scheduleService.shiftTaskJobDueDates(taskId, (int) ChronoUnit.SECONDS.between(activeSession.getLastPauseTime(), activeSession.getLastUnpauseTime()));
            scheduleService.rescheduleTaskJobs(taskId);
            pomodoroWebSocketService.sendPauseUpdate(taskId, false);
            pomodoroWebSocketService.restartPomodoroUpdates(taskId);
        }
        log.info("Unpaused task with ID [{}] on {}", task.getTaskId(), activeSession.getLastUnpauseTime());
    }
    public void endTaskSession(String taskId) {
        Task task = taskRepository.findTaskByTaskId(taskId);
        Optional<Session> session = sessionRepository.findSessionByTaskIdAndActiveIsTrue(taskId);
        Session activeSession = session.orElseThrow(() -> new IllegalStateException("Cannot end task session because it is not active"));
        Duration elapsedTime = Duration.between(activeSession.getLastUnpauseTime(), LocalDateTime.now());
        if (activeSession.isRunning()) {
            activeSession.setTotalSessionTime(activeSession.getTotalSessionTime().plus(elapsedTime));
        }
        activeSession.setEndTime(LocalDateTime.now());
        activeSession.setRunning(false);
        activeSession.setActive(false);
        sessionRepository.save(activeSession);
        pomodoroWebSocketService.endPomodoroUpdates(taskId);
        log.info("Ended session for task with ID [{}] on {}", task.getTaskId(), activeSession.getEndTime());
    }
    public void startPomodoro(String taskId, int focusDuration,
                              int shortBreakDuration, int longBreakDuration,
                              int numFocuses, int longBreakCooldown) {
        taskService.endAllSessions();
        startTaskSession(taskId, true);
        scheduleService.schedulePomoJobs(taskId, focusDuration, shortBreakDuration, longBreakDuration, numFocuses, longBreakCooldown);
        // Start sending WebSocket updates
        pomodoroWebSocketService.startPomodoroUpdates(taskId, numFocuses);
    }
}
