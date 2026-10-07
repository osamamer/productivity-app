package org.osama.task;

import org.jetbrains.annotations.NotNull;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.time.LocalDateTime;

public interface TaskRepository extends JpaRepository<Task, String>,
                                        JpaSpecificationExecutor<Task> {

    interface ProjectTaskCount {
        String getProjectId();

        long getTaskCount();

        long getCompletedTaskCount();
    }

    Optional<Task> findTaskByTaskId(String taskId);

    Optional<Task> findTaskByTaskIdAndUserId(String taskId, String userId);

    List<Task> findAllByUserIdAndParentIdIsNullOrderByDisplayOrderAsc(String userId);

    List<Task> findAllByUserIdAndParentIdOrderByDisplayOrderAsc(String userId, String parentId);

    List<Task> findAllByUserIdAndParentIdOrderByDisplayOrderAscCreationDateTimeAscTaskIdAsc(
            String userId, String parentId);

    List<Task> findAllByUserId(String userId);

    List<Task> findAllByUserIdAndNameIgnoreCase(String userId, String name);

    List<Task> findAllByUserIdAndScheduledPerformDateTimeGreaterThanEqualOrderByScheduledPerformDateTimeAsc(
            String userId, LocalDateTime scheduledPerformDateTime);

    Optional<Task> findTopByUserIdAndParentIdIsNullOrderByDisplayOrderDesc(String userId);

    Optional<Task> findTopByUserIdAndParentIdOrderByDisplayOrderDesc(String userId, String parentId);

    List<Task> findAllByTaskIdInAndUserId(Collection<String> taskIds, String userId);

    List<Task> findAllByTaskSeriesIdOrderBySeriesOccurrenceAtAsc(String taskSeriesId);

    List<Task> findAllByTaskSeriesIdAndUserIdOrderBySeriesOccurrenceAtAsc(String taskSeriesId, String userId);

    @Modifying
    @Query(value = "UPDATE task SET calendar_id = :calendarId WHERE task_series_id = :seriesId AND user_id = :userId",
            nativeQuery = true)
    int updateCalendarForSeries(@Param("seriesId") String seriesId, @Param("userId") String userId,
                                @Param("calendarId") String calendarId);

    List<Task> findAllByTaskSeriesIdAndUserIdAndSeriesOccurrenceAtGreaterThanEqualAndSeriesOccurrenceAtLessThanOrderBySeriesOccurrenceAtAsc(
            String taskSeriesId, String userId, LocalDateTime from, LocalDateTime toExclusive);

    Optional<Task> findByTaskSeriesIdAndSeriesOccurrenceAt(String taskSeriesId, LocalDateTime seriesOccurrenceAt);

    @Query(value = "select exists(select 1 from task where task_series_id = :seriesId "
            + "and series_occurrence_at = :occurrenceAt)", nativeQuery = true)
    boolean existsAnyByTaskSeriesIdAndSeriesOccurrenceAt(@Param("seriesId") String seriesId,
                                                         @Param("occurrenceAt") LocalDateTime occurrenceAt);

    List<Task> findAllByTaskSeriesIdAndSeriesOccurrenceAtAfter(String taskSeriesId, LocalDateTime seriesOccurrenceAt);

    @Query("""
            select t.projectId as projectId,
                   count(t) as taskCount,
                   sum(case when t.completed = true then 1 else 0 end) as completedTaskCount
            from Task t
            where t.userId = :userId
              and t.projectId in :projectIds
              and t.parentId is null
              and t.skipped = false
              and t.softDeleted = false
            group by t.projectId
            """)
    List<ProjectTaskCount> countTasksByProjectIds(@Param("userId") String userId,
                                                  @Param("projectIds") Collection<String> projectIds);

    @Modifying
    @Query("update Task t set t.projectId = null where t.projectId = :projectId and t.userId = :userId and t.softDeleted = false")
    int clearProjectAssignments(@Param("projectId") String projectId, @Param("userId") String userId);

    @Modifying
    @Query("update Task t set t.mentalThreadId = null where t.mentalThreadId = :threadId and t.softDeleted = false")
    int clearMentalThreadAssignments(@Param("threadId") String threadId);
}
