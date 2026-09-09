package org.osama.task;

import org.jetbrains.annotations.NotNull;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.time.LocalDateTime;

public interface TaskRepository extends JpaRepository<Task, String>,
                                        JpaSpecificationExecutor<Task> {

    Optional<Task> findTaskByTaskId(String taskId);

    Optional<Task> findTaskByTaskIdAndUserId(String taskId, String userId);

    List<Task> findAllByUserIdAndParentIdIsNullOrderByDisplayOrderAsc(String userId);

    List<Task> findAllByUserIdAndParentIdOrderByDisplayOrderAsc(String userId, String parentId);

    List<Task> findAllByUserId(String userId);

    List<Task> findAllByUserIdAndScheduledPerformDateTimeGreaterThanEqualOrderByScheduledPerformDateTimeAsc(
            String userId, LocalDateTime scheduledPerformDateTime);

    Optional<Task> findTopByUserIdAndParentIdIsNullOrderByDisplayOrderDesc(String userId);

    Optional<Task> findTopByUserIdAndParentIdOrderByDisplayOrderDesc(String userId, String parentId);

    List<Task> findAllByTaskIdInAndUserId(Collection<String> taskIds, String userId);

    void deleteTaskByTaskId(String taskId);

    List<Task> findAllByTaskSeriesIdOrderBySeriesOccurrenceAtAsc(String taskSeriesId);

    List<Task> findAllByTaskSeriesIdAndUserIdAndSeriesOccurrenceAtGreaterThanEqualAndSeriesOccurrenceAtLessThanOrderBySeriesOccurrenceAtAsc(
            String taskSeriesId, String userId, LocalDateTime from, LocalDateTime toExclusive);

    Optional<Task> findByTaskSeriesIdAndSeriesOccurrenceAt(String taskSeriesId, LocalDateTime seriesOccurrenceAt);

    List<Task> findAllByTaskSeriesIdAndSeriesOccurrenceAtAfter(String taskSeriesId, LocalDateTime seriesOccurrenceAt);


}
