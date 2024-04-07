package org.osama.task;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
@Repository
public interface TaskJpaRepository extends JpaRepository<Task, String> {
    List<Task> findAllByName(String name);

    List<Task> findAllByParentId(String taskId);
    List<Task> findAllByCompletedIsFalse();

    List<Task> findAllByCreationDate(LocalDate localDate);
    Task findFirstByCompletedIsFalseOrderByImportanceDescCreationDateTimeDesc();
}
