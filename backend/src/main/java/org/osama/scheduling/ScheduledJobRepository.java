package org.osama.scheduling;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import jakarta.persistence.LockModeType;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface ScheduledJobRepository extends JpaRepository<ScheduledJob, String> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select job from ScheduledJob job join fetch job.user where job.jobId = :jobId")
    Optional<ScheduledJob> lockByJobId(@Param("jobId") String jobId);

    List<ScheduledJob> findAllByDueDateBetween(LocalDateTime intervalStart, LocalDateTime intervalEnd);
    List<ScheduledJob> findAllByScheduledIsTrueAndDueDateBetween(LocalDateTime intervalStart, LocalDateTime intervalEnd);
    List<ScheduledJob> findAllByScheduledIsTrueAndDueDateLessThanEqualOrderByDueDateAsc(LocalDateTime dueDate);
    List<ScheduledJob> findAllByAssociatedTaskId(String taskId);
    List<ScheduledJob> findAllByScheduledIsTrueAndAssociatedTaskId(String taskId);
    List<ScheduledJob> findAllByScheduledIsFalseAndAssociatedTaskId(String taskId);



}
