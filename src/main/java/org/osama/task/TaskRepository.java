package org.osama.task;

import java.util.List;

public interface TaskRepository {
    List<Task> getAll();
    void add(Task task);
    void remove(String taskId);
    Task getTaskById(String taskId);
    List<Task> getTasksByName(String taskName);

    Task update(Task task);
}


