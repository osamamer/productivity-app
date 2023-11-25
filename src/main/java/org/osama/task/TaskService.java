package org.osama.task;

import lombok.extern.slf4j.Slf4j;
import org.osama.Controller;
import org.osama.session.Session;
import org.osama.session.SessionRepository;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

@Service
@Slf4j
public class TaskService {
    private final TaskRepository taskRepository;
    private final SessionRepository sessionRepository;

    public TaskService(TaskRepository taskRepository, SessionRepository sessionRepository) {
        this.taskRepository = taskRepository;
        this.sessionRepository = sessionRepository;
    }

    public Duration getAccumulatedTime(String taskId) {
        Duration totalDuration = Duration.ZERO;
        List<Session> sessionList = sessionRepository.findAllByTaskId(taskId);
        for (Session session : sessionList) {
            totalDuration = totalDuration.plus(session.getTotalSessionTime());
        }
        return totalDuration;
    }
    public void setTaskDescription(ModifyTaskRequest taskRequest) {
        Task task = taskRepository.getTaskById(taskRequest.taskId);
        task.setDescription(taskRequest.taskDescription);
        taskRepository.update(task);
    }

    private List<Duration> getDurations(String taskId) {
        return sessionRepository.findAllByTaskId(taskId).stream()
                .map(session ->
                        Objects.isNull(session.getEndTime()) ? Duration.between(session.getStartTime(), LocalDateTime.now()) :
                                Duration.between(session.getStartTime(), session.getEndTime()))
                .toList();
    }

    public boolean isActive(String taskId) {
        return sessionRepository.findSessionByTaskIdAndIsRunningIsTrue(taskId).isPresent();
    }

    public void startTaskSession(String taskId) {
        Task task = taskRepository.getTaskById(taskId);
        Optional<Session> activeSession = sessionRepository.findSessionByTaskIdAndIsRunningIsTrue(task.getTaskId());
        if (activeSession.isPresent()) throw new IllegalStateException("Cannot start a session when the task is already active");
        endAllSessions();
        sessionRepository.save(createSession(task));
        log.info("Started task with ID [{}]", task.getTaskId());
    }
    public void unpauseTaskSession(String taskId) {
        Task task = taskRepository.getTaskById(taskId);
        Optional<Session> session = sessionRepository.findSessionByTaskIdAndIsRunningIsTrue(task.getTaskId());
        if (session.isPresent()) throw new IllegalStateException("Cannot unpause a session when the task is already active");
        session = sessionRepository.findSessionByTaskIdAndIsActiveIsTrue(taskId);
        Session activeSession = session.orElseThrow(() -> new IllegalStateException("Cannot unpause task session because it is not active"));
        activeSession.setRunning(true);
        activeSession.setLastUnpauseTime(LocalDateTime.now());
        sessionRepository.save(activeSession);
    }
    public void pauseTaskSession(String taskId) {
        Task task = taskRepository.getTaskById(taskId);
        Optional<Session> session = sessionRepository.findSessionByTaskIdAndIsRunningIsTrue(taskId);
        Session activeSession = session.orElseThrow(() -> new IllegalStateException("Cannot pause task session because it is not running"));
        activeSession.setRunning(false);
        Duration elapsedTime = Duration.between(activeSession.getLastUnpauseTime(), LocalDateTime.now());
        activeSession.setTotalSessionTime(activeSession.getTotalSessionTime().plus(elapsedTime));
        sessionRepository.save(activeSession);
        log.info("Paused task with ID [{}]", task.getTaskId());
    }

    public Duration endTaskSession(String taskId) {
        Task task = taskRepository.getTaskById(taskId);
        Optional<Session> session = sessionRepository.findSessionByTaskIdAndIsRunningIsTrue(taskId);
        Session activeSession = session.orElseThrow(() -> new IllegalStateException("Cannot end task session because it is not running"));
        Duration elapsedTime = Duration.between(activeSession.getLastUnpauseTime(), LocalDateTime.now());
        activeSession.setTotalSessionTime(activeSession.getTotalSessionTime().plus(elapsedTime));
        activeSession.setEndTime(LocalDateTime.now());
        activeSession.setRunning(false);
        activeSession.setActive(false);
        sessionRepository.save(activeSession);
        log.info("Ended session for task with ID [{}]", task.getTaskId());
        return Duration.between(activeSession.getStartTime(), activeSession.getEndTime());
    }



    private static Session createSession(Task task) {
        Session session = new Session();
        session.setSessionId(UUID.randomUUID().toString());
        session.setTaskId(task.getTaskId());
        session.setStartTime(LocalDateTime.now());
        session.setTotalSessionTime(Duration.ZERO);
        session.setLastUnpauseTime(session.getStartTime());
        session.setActive(true);
        session.setRunning(true);
        return session;
    }

    private void endAllSessions() {
        sessionRepository.findAllByIsRunningIsTrue().forEach(session -> {
            session.setEndTime(LocalDateTime.now());
            session.setRunning(false);
            sessionRepository.save(session);
        });
    }

    public Task createNewTask(NewTaskRequest taskRequest) {
        Task newTask = new Task();
        newTask.setTaskId(UUID.randomUUID().toString());
        newTask.setName(taskRequest.getTaskName());
        newTask.setDescription(taskRequest.getTaskDescription());
        newTask.setCreationDate(LocalDateTime.now());
        taskRepository.add(newTask);
        return newTask;
    }
}
