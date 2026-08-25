package org.osama.session.meditation;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface MeditationSessionRepository extends JpaRepository<MeditationSession, String> {
    Optional<MeditationSession> findMeditationSessionByActiveIsTrue();
    Optional<MeditationSession> findMeditationSessionByIdAndActiveIsTrue(String sessionId);
    Optional<MeditationSession> findMeditationSessionByIdAndRunningIsTrue(String sessionId);
    Optional<MeditationSession> findByIdAndUserId(String sessionId, String userId);
    Optional<MeditationSession> findByUserIdAndActiveIsTrue(String userId);
    Optional<MeditationSession> findByIdAndActiveIsTrueAndUserId(String sessionId, String userId);
    Optional<MeditationSession> findByIdAndRunningIsTrueAndUserId(String sessionId, String userId);
}
