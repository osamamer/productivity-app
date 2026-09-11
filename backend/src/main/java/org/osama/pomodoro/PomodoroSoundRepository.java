package org.osama.pomodoro;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PomodoroSoundRepository extends JpaRepository<PomodoroSound, String> {
    List<PomodoroSound> findAllByUserIdOrderByCreatedAtAsc(String userId);

    Optional<PomodoroSound> findByIdAndUserId(String id, String userId);

    boolean existsByIdAndUserId(String id, String userId);

    long countByUserId(String userId);
}
