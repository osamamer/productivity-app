package org.osama;

import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;

@Service
public class ServiceTask {
    private final TaskRepository taskRepository;

    public ServiceTask(TaskRepository taskRepository) {
        this.taskRepository = taskRepository;
    }

    private void startTaskSession(String taskId) {
        Session newSession = new Session(LocalDateTime.now());
        Task task = taskRepository.getTaskById(taskId);
        task.getSessions().add(newSession);
        task.setActiveSession(newSession);
    }
    private Duration endTaskSession(String taskId, Session session) {
        Task task = taskRepository.getTaskById(taskId);
        session.setEndTime(LocalDateTime.now());
        session.setRunning(false);
        task.setActiveSession(null);
        session.setTimeElapsed(Duration.between(session.getStartTime(), session.getEndTime()));
        return session.getTimeElapsed();
    }
}
