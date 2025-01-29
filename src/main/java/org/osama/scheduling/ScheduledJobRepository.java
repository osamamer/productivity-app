package org.osama.scheduling;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface ScheduledJobRepository extends JpaRepository<ScheduledJob, String> {
    List<ScheduledJob> findAllByDueDateBetween(LocalDateTime intervalStart, LocalDateTime intervalEnd);
    List<ScheduledJob> findAllByScheduledIsTrueAndDueDateBetween(LocalDateTime intervalStart, LocalDateTime intervalEnd);
    List<ScheduledJob> findAllByAssociatedTaskId(String taskId);
    List<ScheduledJob> findAllByScheduledIsTrueAndAssociatedTaskId(String taskId);


}
