package org.osama.task;

import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public class PersistentTaskRepository implements TaskRepository {
    private final TaskJpaRepository taskJpaRepository;
    public PersistentTaskRepository(TaskJpaRepository taskJpaRepository) {
        this.taskJpaRepository = taskJpaRepository;
    }
    @Override
    public List<Task> getAll() {
        return taskJpaRepository.findAll();
    }
    @Override
    public void add(Task task) {
        taskJpaRepository.save(task);
    }
    @Override
    public void remove(String taskId) {
        taskJpaRepository.deleteById(taskId);
    }

    @Override
    public Task getTaskById(String taskId) {
        return taskJpaRepository.findById(taskId)
                .orElseThrow(() -> new IllegalArgumentException("Task does not exist"));
    }
    @Override
    public List<Task> getTasksByName(String taskName) {
        return taskJpaRepository.findAllByName(taskName);
    }
    @Override
    public List<Task> getChildTasks(String taskId) {
        return taskJpaRepository.findAllByParentId(taskId);
    }

    @Override
    public List<Task> getNonCompletedTasks() {
        return taskJpaRepository.findAllByCompletedIsFalse();
    }
    @Override
    public List<Task> getTodayTasks() {
        return taskJpaRepository.findAllByCreationDate(LocalDate.now());
    }

    @Override
    public List<Task> getTasksByDate(LocalDate localDate) {
        return taskJpaRepository.findAllByCreationDate(localDate);
    }

    @Override
    public Task getNewestUncompletedHighestPriorityTask() {
        return taskJpaRepository.findFirstByCompletedIsFalseOrderByImportanceDescCreationDateTimeDesc();
    }

    @Override
    public Task update(Task task) {
        return taskJpaRepository.save(task);
    }


}
