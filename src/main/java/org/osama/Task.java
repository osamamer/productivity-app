package org.osama;

import java.util.UUID;

public class Task {
    private final String name;
    private final String description;
    private final String taskID;

    public String getName() {
        return name;
    }

    public String getDescription() {
        return description;
    }

    public String getTaskID() {
        return taskID;
    }

    public static Task createNewTask(String name, String description) {
        return new Task(name, description);
    }

    public static Task reconstruct(String id, String name, String description) {
        return new Task(name, description, id);
    }

    private Task(String name, String description) {
        this.name = name;
        this.description = description;
        this.taskID = UUID.randomUUID().toString();
    }

    private Task(String name, String description, String taskID) {
        this.name = name;
        this.description = description;
        this.taskID = taskID;
    }
}
