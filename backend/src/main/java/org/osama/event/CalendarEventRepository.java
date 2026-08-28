package org.osama.event;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CalendarEventRepository extends JpaRepository<CalendarEvent, String> {
    List<CalendarEvent> findAllByUserIdOrderByStartDateAscStartTimeAsc(String userId);
    Optional<CalendarEvent> findByIdAndUserId(String id, String userId);
}
