package org.osama.session.activity;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface ActivitySessionRepository extends JpaRepository<ActivitySession, String> {
    Optional<ActivitySession> findFirstByUserIdAndEndedAtIsNullOrderByStartedAtDesc(String userId);

    Optional<ActivitySession> findByIdAndUserId(String id, String userId);

    /** Sessions that overlap [from, to), oldest first; an active one counts as running until now. */
    @Query("""
            select s from ActivitySession s
            where s.userId = :userId and s.startedAt < :to and (s.endedAt is null or s.endedAt > :from)
            order by s.startedAt asc
            """)
    List<ActivitySession> findOverlapping(@Param("userId") String userId, @Param("from") Instant from, @Param("to") Instant to);
}
