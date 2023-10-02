package org.osama.task;

import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.List;

@Repository
@ConditionalOnMissingBean(PersistentTaskRepository.class)
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
            if (taskList.get(i).getTaskId().equals(taskId)) {
                taskList.remove(taskList.get(i));
                break;
            }
        }
    }
    @Override
    public Task getTaskById(String taskId) {
        for (Task currentTask : taskList) {
            if (currentTask.getTaskId().equals(taskId)) {
                return currentTask;
            }
        }
        return null; // Should be an exception
    }

    @Override
    public List<Task> getTasksByName(String taskName) {
        List<Task> list = new ArrayList<>();
        for (Task currentTask : taskList) {
            if (currentTask.getName().equals(taskName)) {
                list.add(currentTask);
            }
        }
        return list;
    }

}
