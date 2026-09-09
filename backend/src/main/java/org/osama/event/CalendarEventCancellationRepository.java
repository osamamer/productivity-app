package org.osama.event;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CalendarEventCancellationRepository extends JpaRepository<CalendarEventCancellation, String> {
    List<CalendarEventCancellation> findAllByEventIdOrderByOccurrenceKeyAsc(String eventId);

    Optional<CalendarEventCancellation> findByEventIdAndOccurrenceKey(String eventId, String occurrenceKey);

    void deleteAllByEventId(String eventId);
}
