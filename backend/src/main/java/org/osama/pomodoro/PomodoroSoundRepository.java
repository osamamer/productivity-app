package org.osama.pomodoro;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface PomodoroSoundRepository extends JpaRepository<PomodoroSound, String> {
    @Query("select new org.osama.pomodoro.PomodoroSoundMetadata(s.id, s.name, s.fileSize) "
            + "from PomodoroSound s where s.user.id = :userId order by s.createdAt asc")
    List<PomodoroSoundMetadata> findMetadataByUserIdOrderByCreatedAtAsc(@Param("userId") String userId);

    Optional<PomodoroSound> findByIdAndUserId(String id, String userId);

    boolean existsByIdAndUserId(String id, String userId);

    long countByUserId(String userId);
}
