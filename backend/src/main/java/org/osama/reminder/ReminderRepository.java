package org.osama.reminder;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;

public interface ReminderRepository extends JpaRepository<Reminder, String> {
    Optional<Reminder> findByEventId(String eventId);
    void deleteByEventId(String eventId);
    Optional<Reminder> findByReminderIdAndUserId(String reminderId, String userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select reminder from Reminder reminder
            join fetch reminder.user user
            left join fetch reminder.event event
            where reminder.acknowledgedAt is null
              and reminder.dateTime <= :now
              and (reminder.dispatchedAt is null or reminder.dispatchedAt <= :retryBefore)
            order by reminder.dateTime
            """)
    List<Reminder> lockDueForPush(@Param("now") Instant now,
                                  @Param("retryBefore") Instant retryBefore,
                                  Pageable pageable);

    @Query("""
            select reminder from Reminder reminder
            left join fetch reminder.event event
            where reminder.userId = :userId
              and reminder.acknowledgedAt is null
              and reminder.dateTime <= :now
            order by reminder.dateTime
            """)
    List<Reminder> findDueForUser(@Param("userId") String userId, @Param("now") Instant now);
}
