package org.osama.calendar;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface CalendarRepository extends JpaRepository<UserCalendar, String> {
    List<UserCalendar> findAllByUserIdOrderByDisplayOrderAscNameAsc(String userId);

    Optional<UserCalendar> findByIdAndUserId(String id, String userId);

    Optional<UserCalendar> findByUserIdAndDefaultCalendarTrue(String userId);

    Optional<UserCalendar> findFirstByUserIdOrderByDisplayOrderDesc(String userId);

    @Query(value = "select calendar_id from app_calendar where calendar_id = :calendarId and user_id = :userId",
            nativeQuery = true)
    Optional<String> findCalendarIdIncludingDeleted(@Param("calendarId") String calendarId,
                                                    @Param("userId") String userId);
}
