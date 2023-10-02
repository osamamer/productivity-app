package org.osama.task;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
@Profile({"test", "postgres"})
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
}
