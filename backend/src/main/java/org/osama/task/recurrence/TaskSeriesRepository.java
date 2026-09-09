package org.osama.task.recurrence;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface TaskSeriesRepository extends JpaRepository<TaskSeries, String> {
    List<TaskSeries> findAllByActiveTrue();

    Optional<TaskSeries> findBySeriesIdAndUserId(String seriesId, String userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select series from TaskSeries series where series.seriesId = :seriesId and series.userId = :userId")
    Optional<TaskSeries> lockBySeriesIdAndUserId(@Param("seriesId") String seriesId, @Param("userId") String userId);
}
