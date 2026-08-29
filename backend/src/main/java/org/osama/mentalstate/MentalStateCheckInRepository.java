package org.osama.mentalstate;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MentalStateCheckInRepository extends JpaRepository<MentalStateCheckIn, String> {
    List<MentalStateCheckIn> findAllByUserIdOrderByRecordedAtDesc(String userId, Pageable pageable);
}
