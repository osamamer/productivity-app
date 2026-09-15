package org.osama.mentalstate;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface MentalStateCheckInRepository extends JpaRepository<MentalStateCheckIn, String> {
    Optional<MentalStateCheckIn> findByIdAndUserId(String id, String userId);

    List<MentalStateCheckIn> findAllByUserIdOrderByRecordedAtDesc(String userId, Pageable pageable);

    List<MentalStateCheckIn> findAllByUserIdAndRecordedAtGreaterThanEqualAndRecordedAtLessThanOrderByRecordedAtAsc(
            String userId, Instant from, Instant to);

    boolean existsByUserIdAndRecordedAtAfter(String userId, Instant recordedAt);
}
