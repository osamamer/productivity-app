package org.osama.task;

import java.time.LocalDate;
import java.util.List;

public interface TaskRepository {
    List<Task> getAll();
    void add(Task task);
    void remove(String taskId);
    Task getTaskById(String taskId);
    List<Task> getTasksByName(String taskName);

    List<Task> getChildTasks(String taskId);
    List<Task> getNonCompletedTasks();
    List<Task> getTodayTasks();

    List<Task> getTasksByDate(LocalDate localDate);


    Task update(Task task);


}


