package org.osama;

import java.util.ArrayList;
import java.util.List;

public class ListTaskRepository implements TaskRepository {
    private final List<Task> taskList = new ArrayList<>();
    @Override
    public List<Task> getAll() {
        return taskList;
    }

    @Override
    public void add(Task task) {
        taskList.add(task);
    }

    @Override
    public void remove(String taskId) {
        final int initialSize = taskList.size();
        attemptRemove(taskId);
        if (taskList.size() == initialSize) throw new IllegalArgumentException(String.format("Task ID [%s] does not exist", taskId));
    }

    private void attemptRemove(String taskId) {
        for (int i = 0; i < taskList.size(); i++) {
            if (taskList.get(i).getTaskID().equals(taskId)) {
                taskList.remove(taskList.get(i));
                break;
            }
        }
    }
}
