package org.osama.session;

import lombok.extern.slf4j.Slf4j;
import org.osama.pomodoro.Pomodoro;
import org.osama.pomodoro.PomodoroRepository;
import org.osama.pomodoro.PomodoroService;
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
    private final PomodoroService pomodoroService;
    private final TaskService taskService;
    private final PomodoroRepository pomodoroRepository;

    public SessionService(TaskRepository taskRepository, SessionRepository sessionRepository,
                          ScheduleService scheduleService, PomodoroRepository pomodoroRepository,
                          PomodoroService pomodoroService, TaskService taskService) {
        this.taskRepository = taskRepository;
        this.sessionRepository = sessionRepository;
        this.scheduleService = scheduleService;
        this.pomodoroService = pomodoroService;
        this.taskService = taskService;
        this.pomodoroRepository = pomodoroRepository;
    }
    private static Session createSession(Task task, Optional<String> pomodoroId) {
        Session session = new Session();
        session.setSessionId(UUID.randomUUID().toString());
        session.setAssociatedTaskId(task.getTaskId());
        session.setStartTime(LocalDateTime.now());
        session.setTotalSessionTime(Duration.ZERO);
        session.setLastUnpauseTime(session.getStartTime());
        session.setActive(true);
        session.setRunning(true);
        session.setPomodoro(false);
        if (pomodoroId.isPresent()) {
            session.setAssociatedPomodoroId(String.valueOf(pomodoroId));
            session.setPomodoro(true);
        }
        log.info("Created session for task with ID [{}]", task.getTaskId());
        return session;
    }
    public void startTaskSession(String taskId, boolean isPomodoro) {
        Task task = taskRepository.findTaskByTaskId(taskId);
        List<Session> activeSessions = sessionRepository.findAllByAssociatedTaskIdAndActiveIsTrue(task.getTaskId());
        if (!activeSessions.isEmpty()) throw new IllegalStateException("Cannot start a session when a task is already active");

        String pomodoroId = Optional.ofNullable(
                pomodoroRepository.findPomodoroByAssociatedTaskId(taskId)
        ).map(Pomodoro::getPomodoroId).orElse(null);
        if (isPomodoro) {
            Pomodoro pomodoro = pomodoroRepository.findPomodoroByAssociatedTaskId(taskId);
            pomodoro.setCurrentFocusNumber(pomodoro.getCurrentFocusNumber() + 1);
            pomodoro.setSessionActive(true);
            pomodoro.setSessionRunning(true);
            pomodoroRepository.save(pomodoro);
            pomodoroService.sendAsyncUpdate(taskId);
            pomodoroService.pausePomodoroUpdates(taskId);
            pomodoroService.startPomodoroUpdates(taskId);
            log.info("Setting pomodoro focus to {}", pomodoro.getCurrentFocusNumber());
        }
        Session session = createSession(task, Optional.ofNullable(pomodoroId));
        sessionRepository.save(session);
        log.info("Started session for task with ID [{}] on {}", task.getTaskId(), session.getStartTime());
    }
    public void pauseTaskSession(String taskId) {
        Task task = taskRepository.findTaskByTaskId(taskId);
        Optional<Session> session = sessionRepository.findSessionByAssociatedTaskIdAndRunningIsTrue(taskId);
        Session activeSession = session.orElseThrow(() -> new IllegalStateException("Cannot pause task session because it is not running"));
        activeSession.setRunning(false);
        Duration elapsedTime = Duration.between(activeSession.getLastUnpauseTime(), LocalDateTime.now());
        activeSession.setTotalSessionTime(activeSession.getTotalSessionTime().plus(elapsedTime));
        activeSession.setLastPauseTime(LocalDateTime.now());
        sessionRepository.save(activeSession);
        if (activeSession.isPomodoro()) {
            Pomodoro pomodoro = pomodoroRepository.findPomodoroByAssociatedTaskId(taskId);
            pomodoro.setSessionRunning(false);
            pomodoroRepository.save(pomodoro);

            scheduleService.unscheduleTaskJobs(taskId);
            pomodoroService.pausePomodoroUpdates(taskId);
            pomodoroService.sendAsyncUpdate(taskId);
        }
        log.info("Paused task with ID [{}] on {}", task.getTaskId(), activeSession.getLastPauseTime());
    }
    public void unpauseTaskSession(String taskId) {
        Task task = taskRepository.findTaskByTaskId(taskId);
        Optional<Session> session = sessionRepository.findSessionByAssociatedTaskIdAndRunningIsTrue(task.getTaskId());
        if (session.isPresent()) throw new IllegalStateException("Cannot unpause a session when the task is already running");
        session = sessionRepository.findSessionByAssociatedTaskIdAndActiveIsTrue(taskId);
        Session activeSession = session.orElseThrow(() -> new IllegalStateException("Cannot unpause task session because it is not active"));
        activeSession.setRunning(true);
        activeSession.setLastUnpauseTime(LocalDateTime.now());
        sessionRepository.save(activeSession);
        if (activeSession.isPomodoro()) {
            scheduleService.shiftTaskJobDueDates(taskId, (int) ChronoUnit.SECONDS.between(activeSession.getLastPauseTime(), activeSession.getLastUnpauseTime()));
            scheduleService.rescheduleTaskJobs(taskId);
            pomodoroService.sendAsyncUpdate(taskId);
            Pomodoro pomodoro = pomodoroRepository.findPomodoroByAssociatedTaskId(taskId);
            pomodoro.setSessionRunning(true);
            pomodoroRepository.save(pomodoro);
            pomodoroService.startPomodoroUpdates(taskId);
        }
        log.info("Unpaused task with ID [{}] on {}", task.getTaskId(), activeSession.getLastUnpauseTime());
    }
    public void endTaskSession(String taskId) {
        Task task = taskRepository.findTaskByTaskId(taskId);
        Optional<Session> session = sessionRepository.findSessionByAssociatedTaskIdAndActiveIsTrue(taskId);
        Session activeSession = session.orElseThrow(() -> new IllegalStateException("Cannot end task session because it is not active"));
        Duration elapsedTime = Duration.between(activeSession.getLastUnpauseTime(), LocalDateTime.now());
        if (activeSession.isRunning()) {
            activeSession.setTotalSessionTime(activeSession.getTotalSessionTime().plus(elapsedTime));
        }
        activeSession.setEndTime(LocalDateTime.now());
        activeSession.setRunning(false);
        activeSession.setActive(false);
        sessionRepository.save(activeSession);
        if (activeSession.isPomodoro()) {
            Pomodoro pomodoro = pomodoroRepository.findPomodoroByAssociatedTaskId(taskId);
            pomodoro.setSecondsPassedInSession(0);
            pomodoro.setSessionActive(false);
            pomodoro.setSessionRunning(false);
            pomodoroRepository.save(pomodoro);

            pomodoroService.pausePomodoroUpdates(taskId);
            pomodoroService.startPomodoroUpdates(taskId);
//            scheduleService.unscheduleTaskJobs(taskId);
//            pomodoroService.endPomodoroUpdates(taskId);
        }

        log.info("Ended session for task with ID [{}] on {}", task.getTaskId(), activeSession.getEndTime());
    }
    public void startPomodoro(String taskId, int focusDuration,
                              int shortBreakDuration, int longBreakDuration,
                              int numFocuses, int longBreakCooldown) {

        taskService.endAllSessions();
        Pomodoro pomodoro = pomodoroService.createPomodoro(taskId, focusDuration, shortBreakDuration, longBreakDuration, numFocuses, longBreakCooldown);
        startTaskSession(taskId, true);
        scheduleService.schedulePomoJobs(taskId);
        pomodoroService.startPomodoroUpdates(taskId);
    }
    public void endPomodoro(String taskId) {
        endTaskSession(taskId);
        Pomodoro pomodoro = pomodoroRepository.findPomodoroByAssociatedTaskId(taskId);
        pomodoro.setSessionRunning(false);
        pomodoro.setSessionActive(false);
        pomodoro.setActive(false);
        pomodoroRepository.save(pomodoro);

        scheduleService.unscheduleTaskJobs(taskId);
        pomodoroService.pausePomodoroUpdates(taskId);
        pomodoroService.sendAsyncUpdate(taskId);

        pomodoroRepository.delete(pomodoro);


    }
}
