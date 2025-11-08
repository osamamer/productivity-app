package org.osama.task;

import org.jetbrains.annotations.NotNull;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface TaskRepository extends JpaRepository<Task, String> {
    @NotNull
    List<Task> findAll();

    Task findTaskByTaskId(String taskId);

    List<Task> findAllByName(String name);
    List<Task> findAllByParentIdIsNull();

    List<Task> findAllByParentIdOrderByCreationDateTimeAsc(String taskId);

    List<Task> findAllByCompletedIsFalseOrderByCreationDateTimeDesc();

    List<Task> findAllByCreationDateOrderByCreationDateTimeDesc(LocalDate creationDate);

    Task findFirstByCompletedIsFalseOrderByImportanceDescCreationDateTimeDesc();

    List<Task> findAllByScheduledPerformDate(LocalDate scheduledPerformDate);

    List<Task> findAllByCreationDateAndCompletedIsTrueOrderByCreationDateTimeDesc(LocalDate localDate);

    void deleteTaskByTaskId(String taskId);

    List<Task> findByCreationDateNot(LocalDate creationDate);

    List<Task> findAllByScheduledPerformDateBeforeAndParentIdIsNullOrderByCompletedAscCreationDateTimeDesc(LocalDate performDate);

    List<Task> findAllByScheduledPerformDateAfterAndParentIdIsNullOrderByCompletedAscCreationDateTimeDesc(LocalDate performDate);
    List<Task> findAllByScheduledPerformDateAndParentIdIsNullOrderByCompletedAscCreationDateTimeDesc(LocalDate performDate);
}


