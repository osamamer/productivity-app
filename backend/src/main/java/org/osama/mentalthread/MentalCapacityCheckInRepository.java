package org.osama.mentalthread;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.Optional;

public interface MentalCapacityCheckInRepository extends JpaRepository<MentalCapacityCheckIn, String> {
    Optional<MentalCapacityCheckIn> findByUserIdAndDate(String userId, LocalDate date);
}
