package org.osama;

import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;

@Service
public class TaskService {
    private final TaskRepository taskRepository;

    public TaskService(TaskRepository taskRepository) {
        this.taskRepository = taskRepository;
    }

    public void startTaskSession(String taskId) {
        Task task = taskRepository.getTaskById(taskId);
        if (task.isActive()) return;
        task.setActive(true);
        Session newSession = new Session(LocalDateTime.now());
        task.getSessions().add(newSession);
        task.setActiveSession(newSession);
    }
    public Duration endTaskSession(String taskId, Session session) {
        Task task = taskRepository.getTaskById(taskId);
        session.setEndTime(LocalDateTime.now());
        session.setRunning(false);
        task.setActiveSession(null);
        task.setActive(false);
        session.setTimeElapsed(Duration.between(session.getStartTime(), session.getEndTime()));
        return session.getTimeElapsed();
    }
}
