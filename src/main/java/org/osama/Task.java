package org.osama;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Data
public class Task {
    private final String name;
    private final String description;
    private final String taskId;
    private final List<Session> sessions = new ArrayList<>();
    private Session activeSession;
    private boolean isActive;
    private long accumulatedTime;


    public static Task createNewTask(String name, String description) {
        return new Task(name, description);
    }

    public static Task reconstruct(String id, String name, String description) {
        return new Task(name, description, id);
    }

    private Task(String name, String description) {
        this.name = name;
        this.description = description;
        this.taskId = UUID.randomUUID().toString();
        this.isActive = false;
    }

    private Task(String name, String description, String taskId) {
        this.name = name;
        this.description = description;
        this.taskId = taskId;
    }
}
