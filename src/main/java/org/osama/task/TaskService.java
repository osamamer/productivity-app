package org.osama.task;

import lombok.extern.slf4j.Slf4j;
import org.osama.session.Session;
import org.osama.session.SessionRepository;
import org.springframework.stereotype.Service;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
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

    public boolean getTaskRunning(String taskId) {
        return !sessionRepository.findAllByTaskIdAndIsRunningIsTrue(taskId).isEmpty();
    }
    public boolean getTaskActive(String taskId) {
        return !sessionRepository.findAllByTaskIdAndIsActiveIsTrue(taskId).isEmpty();
    }
    public void startTaskSession(String taskId) {
        Task task = taskRepository.getTaskById(taskId);
        List<Session> activeSessions = sessionRepository.findAllByTaskIdAndIsActiveIsTrue(task.getTaskId());
        if (activeSessions.size() != 0) throw new IllegalStateException("Cannot start a session when the task is already active");
//        endAllSessions();
        sessionRepository.save(createSession(task));
        log.info("Started task with ID [{}]", task.getTaskId());
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
    public void unpauseTaskSession(String taskId) {
        Task task = taskRepository.getTaskById(taskId);
        Optional<Session> session = sessionRepository.findSessionByTaskIdAndIsRunningIsTrue(task.getTaskId());
        if (session.isPresent()) throw new IllegalStateException("Cannot unpause a session when the task is already running");
        session = sessionRepository.findSessionByTaskIdAndIsActiveIsTrue(taskId);
        Session activeSession = session.orElseThrow(() -> new IllegalStateException("Cannot unpause task session because it is not active"));
        activeSession.setRunning(true);
        activeSession.setLastUnpauseTime(LocalDateTime.now());
        sessionRepository.save(activeSession);
        log.info("Unpaused task with ID [{}]", task.getTaskId());
    }
    public void endTaskSession(String taskId) {
        Task task = taskRepository.getTaskById(taskId);
        Optional<Session> session = sessionRepository.findSessionByTaskIdAndIsActiveIsTrue(taskId);
        Session activeSession = session.orElseThrow(() -> new IllegalStateException("Cannot end task session because it is not active"));
        Duration elapsedTime = Duration.between(activeSession.getLastUnpauseTime(), LocalDateTime.now());
        if (activeSession.isRunning()) {
            activeSession.setTotalSessionTime(activeSession.getTotalSessionTime().plus(elapsedTime));
        }
        activeSession.setEndTime(LocalDateTime.now());
        activeSession.setRunning(false);
        activeSession.setActive(false);
        sessionRepository.save(activeSession);
        log.info("Ended session for task with ID [{}]", task.getTaskId());
    }
    public void completeTask(String taskId) {
        Task task = taskRepository.getTaskById(taskId);
        task.setCompleted(true);
        taskRepository.update(task);
    }
    public boolean getTaskCompleted(String taskId) {
        Task task = taskRepository.getTaskById(taskId);
        return task.isCompleted();
    }
    public void changeTaskName(String taskId, String newName) {
        Task task = taskRepository.getTaskById(taskId);
        task.setName(newName);
        taskRepository.update(task);
    }
    public void setParentTask(String taskId, String parentId) {
        Task task = taskRepository.getTaskById(taskId);
        task.setParentId(parentId);
        taskRepository.update(task);
    }
    public Task getParentTask(String taskId) {
        Task task = taskRepository.getTaskById(taskId);
        return taskRepository.getTaskById(task.getParentId());
    }
    public List<Task> getChildTasks(String taskId) {
        return taskRepository.getChildTasks(taskId);
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

    public void endAllSessions() {
        sessionRepository.findAll()
                .stream().filter(Session::isActive)
                .forEach(activeSession -> {
            activeSession.setEndTime(LocalDateTime.now());
            activeSession.setRunning(false);
            activeSession.setActive(false);
            sessionRepository.save(activeSession);
        });
    }
    public Task createNewTask(NewTaskRequest taskRequest) {
        Task newTask = new Task();
        newTask.setTaskId(UUID.randomUUID().toString());
        newTask.setName(taskRequest.getTaskName());
        newTask.setDescription(taskRequest.getTaskDescription());
        newTask.setCreationDateTime(LocalDateTime.now());
        newTask.setCompleted(false);
        taskRepository.add(newTask);
        return newTask;
    }
}
