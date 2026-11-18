package org.osama.event;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface CalendarEventRepository extends JpaRepository<CalendarEvent, String> {
    List<CalendarEvent> findAllByUserIdOrderByStartDateAscStartTimeAsc(String userId);
    Optional<CalendarEvent> findByIdAndUserId(String id, String userId);
    List<CalendarEvent> findAllBySourceId(String sourceId);

    @Modifying
    @Query("update CalendarEvent e set e.activityId = null where e.activityId = :activityId and e.userId = :userId")
    int clearActivity(@Param("activityId") String activityId, @Param("userId") String userId);
}
