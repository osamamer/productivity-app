package org.osama.calendar;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface CalendarSourceRepository extends JpaRepository<CalendarSource, String> {
    List<CalendarSource> findAllByUserId(String userId);
    List<CalendarSource> findAllByType(CalendarSource.Type type);
    Optional<CalendarSource> findByCalendarIdAndUserId(String calendarId, String userId);
    Optional<CalendarSource> findByIdAndUserId(String id, String userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select source from CalendarSource source where source.id = :id and source.userId = :userId")
    Optional<CalendarSource> lockByIdAndUserId(@Param("id") String id, @Param("userId") String userId);
}
