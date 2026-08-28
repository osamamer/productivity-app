package org.osama.reminder;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface ReminderRepository extends JpaRepository<Reminder, String> {
    Optional<Reminder> findByEventId(String eventId);
    void deleteByEventId(String eventId);
    Optional<Reminder> findByReminderIdAndUserId(String reminderId, String userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select reminder from Reminder reminder
            join fetch reminder.event event
            where reminder.acknowledgedAt is null
              and reminder.dispatchedAt is null
              and reminder.dateTime <= :now
            order by reminder.dateTime
            """)
    List<Reminder> lockDueUndispatched(@Param("now") Instant now);

    @Query("""
            select reminder from Reminder reminder
            join fetch reminder.event event
            where reminder.userId = :userId
              and reminder.acknowledgedAt is null
              and reminder.dateTime <= :now
            order by reminder.dateTime
            """)
    List<Reminder> findPendingForUser(@Param("userId") String userId, @Param("now") Instant now);
}
