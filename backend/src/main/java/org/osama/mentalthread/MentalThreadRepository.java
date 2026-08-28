package org.osama.mentalthread;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MentalThreadRepository extends JpaRepository<MentalThread, String> {
    List<MentalThread> findAllByUserId(String userId);

    List<MentalThread> findAllByUserIdAndStatus(String userId, MentalThreadStatus status);

    Optional<MentalThread> findByIdAndUserId(String id, String userId);
}
