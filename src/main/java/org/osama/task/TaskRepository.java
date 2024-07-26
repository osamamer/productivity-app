package org.osama.task;

import org.jetbrains.annotations.NotNull;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public interface TaskRepository extends JpaRepository<Task, String> {
    @NotNull
    List<Task> findAll();
    Task findTaskByTaskId(String taskId);
    List<Task> findAllByName(String name);
    List<Task> findAllByParentId(String taskId);
    List<Task> findAllByCompletedIsFalse();
    List<Task> findAllByCreationDate(LocalDate creationDate);
    Task findFirstByCompletedIsFalseOrderByImportanceDescCreationDateTimeDesc();
    List<Task> findAllByScheduledPerformDate(LocalDate scheduledPerformDate);
    List<Task> findAllByCreationDateAndCompletedIsTrueOrderByCreationDateTimeDesc(LocalDate localDate);
    void deleteTaskByTaskId(String taskId);

}


